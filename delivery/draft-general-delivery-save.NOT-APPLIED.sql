-- ARTESSENCIA — PROPOSTA NÃO EXECUTADA
-- Nova função v2 isolada: NÃO substitui a RPC v1 utilizada pela aplicação.
-- Protege deliveryZoneConfig contra sobrescrita por Backoffice desatualizado.
-- NÃO aplicar sem testar conflitos com cloud push e função draft-zone-rpc.

create or replace function public.artessencia_save_shop_delivery_v2(p_shop_delivery jsonb, p_expected_revision bigint)
returns boolean language plpgsql security invoker set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
  v_state_current jsonb;
  v_current jsonb;
  v_merged jsonb;
  v_zone jsonb;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not public.artessencia_is_owner_v1() then raise exception 'store owner required'; end if;
  if jsonb_typeof(p_shop_delivery) is distinct from 'object' then
    raise exception 'invalid shop delivery settings';
  end if;

  -- Obter o lock na mesma ordem da futura RPC de rascunhos:
  -- primeiro o estado principal; depois as definições da Loja.
  select revision, coalesce(data #> '{settings,shopDelivery}', '{}'::jsonb)
    into v_revision, v_state_current
    from public.artessencia_v1_state where user_id=v_uid for update;
  if not found then raise exception 'backoffice state missing'; end if;
  if p_expected_revision is null or v_revision is distinct from p_expected_revision then
    raise exception 'cloud_revision_conflict';
  end if;

  -- Não criar configurações vazias automaticamente: falhar em segurança.
  if not exists (
    select 1 from public.artessencia_v1_state
    where user_id=v_uid and jsonb_typeof(data->'settings')='object'
  ) then
    raise exception 'main settings object missing';
  end if;

  select coalesce(data->'delivery','{}'::jsonb)
    into v_current from public.artessencia_shop_settings
    where user_id=v_uid for update;

  if not found or jsonb_typeof(v_current) is distinct from 'object' then
    raise exception 'shop delivery settings missing';
  end if;
  if jsonb_typeof(v_state_current) is distinct from 'object' then
    raise exception 'invalid main delivery settings';
  end if;
  if v_state_current is distinct from v_current then
    raise exception 'delivery sources diverged';
  end if;

  -- Não permitir que o corpo enviado pelo navegador altere a nova chave;
  -- a fonte é o valor que está efetivamente no servidor.
  v_zone := v_current->'deliveryZoneConfig';
  v_merged := p_shop_delivery - 'deliveryZoneConfig';
  if v_zone is not null then
    v_merged := v_merged || jsonb_build_object('deliveryZoneConfig',v_zone);
  end if;

  update public.artessencia_shop_settings
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_merged,true),
      updated_at=now()
  where user_id=v_uid;

  update public.artessencia_v1_state
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_merged,true),
      revision=coalesce(revision,0)+1,updated_at=now()
  where user_id=v_uid;

  -- Mesclar as duas opções sem eliminar outras chaves fulfillment.
  insert into public.store_settings(key,value,updated_at)
  values('fulfillment',
    jsonb_build_object(
      'pickup_enabled',coalesce((v_merged->>'pickupEnabled')::boolean,false),
      'delivery_enabled',coalesce((v_merged->>'localDeliveryEnabled')::boolean,false)
    ),now())
  on conflict(key) do update
    set value=coalesce(public.store_settings.value,'{}'::jsonb) || excluded.value,
        updated_at=now();

  if not (
      coalesce((v_merged->>'pickupEnabled')::boolean,false)
      or coalesce((v_merged->>'localDeliveryEnabled')::boolean,false)
  ) then
    update public.store_settings
       set value=coalesce(value,'{}'::jsonb)||jsonb_build_object('accepting_orders',false),
           updated_at=now()
     where key='store_status';
  end if;
  return true;
end;
$function$;

-- A v1 continua inalterada. É necessário adaptar o chamador para fornecer
-- p_expected_revision e testar conflitos/atualizações reais antes da migração.
-- Uma chamada v1 concorrente não respeita este protocolo: não ativar até migrar.
-- Rever explicitamente privilégios EXECUTE antes de aplicar.
