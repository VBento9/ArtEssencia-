-- ARTESSENCIA — PROPOSTA NÃO EXECUTADA
-- Revisão da função existente. Mantém o seu nome e contrato.
-- Protege deliveryZoneConfig contra sobrescrita por Backoffice desatualizado.
-- NÃO aplicar sem testar conflitos com cloud push e função draft-zone-rpc.

create or replace function public.artessencia_save_shop_delivery_v1(p_shop_delivery jsonb)
returns boolean language plpgsql set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
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
  perform 1 from public.artessencia_v1_state where user_id=v_uid for update;
  if not found then raise exception 'backoffice state missing'; end if;

  insert into public.artessencia_shop_settings(user_id,data,updated_at)
  values(v_uid,jsonb_build_object('delivery','{}'::jsonb),now())
  on conflict(user_id) do nothing;

  select coalesce(data->'delivery','{}'::jsonb)
    into v_current from public.artessencia_shop_settings
    where user_id=v_uid for update;

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

  -- Preservar comportamento original de fulfillment e fecho preventivo.
  insert into public.store_settings(key,value,updated_at)
  values('fulfillment',
    jsonb_build_object(
      'pickup_enabled',coalesce((v_merged->>'pickupEnabled')::boolean,false),
      'delivery_enabled',coalesce((v_merged->>'localDeliveryEnabled')::boolean,false)
    ),now())
  on conflict(key) do update set value=excluded.value,updated_at=now();

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

-- Limitação ainda aberta: esta função NÃO implementa controlo de revisão
-- para todos os campos antigos; exige revisão do cloud push geral antes de aplicar.
