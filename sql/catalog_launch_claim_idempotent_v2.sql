-- Reforço de idempotência e unicidade do claim de vouchers de lançamento.
-- Não altera vouchers existentes; apenas reforça geração e associação futura.

create unique index if not exists artessencia_catalog_launch_promo_unique
  on public.artessencia_catalog_launch_challenges(promo_id)
  where promo_id is not null;

create or replace function public.artessencia_catalog_launch_claim_v1(
  p_visitor_id uuid,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_owner uuid;
  v_cfg public.artessencia_catalog_launch_config%rowtype;
  v_ch public.artessencia_catalog_launch_challenges%rowtype;
  v_digits text;
  v_key text;
  v_code text;
  v_promo uuid;
  i integer:=0;
begin
  select user_id into v_owner
  from public.store_owner
  where active=true
  order by created_at
  limit 1;

  if v_owner is null then
    raise exception 'campaign unavailable';
  end if;

  select * into v_cfg
  from public.artessencia_catalog_launch_config
  where owner_id=v_owner and enabled=true;

  if not found
     or (v_cfg.starts_at is not null and now()<v_cfg.starts_at)
     or (v_cfg.ends_at is not null and now()>v_cfg.ends_at) then
    raise exception 'campaign unavailable';
  end if;

  select * into v_ch
  from public.artessencia_catalog_launch_challenges
  where owner_id=v_owner and visitor_id=p_visitor_id
  for update;

  if not found or v_ch.completed_at is null then
    raise exception 'challenge incomplete';
  end if;

  v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if length(v_digits)<9 or length(v_digits)>15 then
    raise exception 'invalid phone';
  end if;
  if length(v_digits)=9 then
    v_digits:='351'||v_digits;
  end if;
  v_key:='p:'||v_digits;

  -- Serializa claims pelo mesmo telefone normalizado.
  perform pg_advisory_xact_lock(
    hashtext('artessencia-launch-phone-'||v_owner::text||'-'||v_key)
  );

  -- Retry/refresh do mesmo participante: devolve sempre o voucher já criado.
  if v_ch.promo_id is not null then
    return jsonb_build_object(
      'ok',true,
      'code',(select code from public.artessencia_promo_codes where id=v_ch.promo_id),
      'already_claimed',true
    );
  end if;

  -- Um telefone só pode reclamar um voucher de lançamento.
  if exists(
    select 1
    from public.artessencia_catalog_launch_challenges c
    where c.owner_id=v_owner
      and c.customer_key=v_key
      and c.claimed_at is not null
      and c.id<>v_ch.id
  ) then
    raise exception 'reward already claimed';
  end if;

  -- Geração atómica: se houver colisão real do código/UUID, gera outro.
  loop
    i:=i+1;
    if i>20 then
      raise exception 'could not generate code';
    end if;

    v_code:='AE-LANC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,7));
    v_promo:=gen_random_uuid();

    begin
      insert into public.artessencia_promo_codes(
        id,owner_id,code,label,discount_type,discount_value,max_discount,min_order,
        first_purchase_only,usage_limit,per_customer_limit,starts_at,ends_at,active,
        created_at,updated_at,assigned_customer_key
      ) values(
        v_promo,v_owner,v_code,v_cfg.label,v_cfg.discount_type,v_cfg.discount_value,
        v_cfg.max_discount,v_cfg.min_order,false,1,1,now(),
        now()+(v_cfg.validity_days||' days')::interval,true,now(),now(),v_key
      );
      exit;
    exception
      when unique_violation then
        -- A constraint da base ganha sempre; tentar novamente com novo código/UUID.
        null;
    end;
  end loop;

  update public.artessencia_catalog_launch_challenges
  set claimed_at=now(),
      customer_phone=p_phone,
      customer_key=v_key,
      promo_id=v_promo,
      updated_at=now()
  where id=v_ch.id;

  return jsonb_build_object(
    'ok',true,
    'code',v_code,
    'already_claimed',false
  );
end $$;

revoke execute on function public.artessencia_catalog_launch_claim_v1(uuid,text)
  from public,authenticated;
grant execute on function public.artessencia_catalog_launch_claim_v1(uuid,text)
  to anon;
