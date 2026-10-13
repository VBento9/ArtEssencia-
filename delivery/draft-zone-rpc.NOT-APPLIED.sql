-- ARTESSENCIA — PROPOSTA NÃO APLICADA / APENAS PARA REVISÃO
-- NÃO INSTALAR: a RPC v1 e o cloud push geral ainda não partilham este protocolo.
create or replace function public.artessencia_save_delivery_zone_draft_v1(
  p_expected_revision bigint, p_zones jsonb
) returns bigint
language plpgsql security invoker set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
  v_main jsonb;
  v_shop jsonb;
  v_zone jsonb;
  v_code_value jsonb;
  v_code text;
  v_name text;
  v_fee_text text;
  v_seen_codes text[] := array[]::text[];
  v_seen_names text[] := array[]::text[];
  v_total_codes integer := 0;
  v_draft jsonb;
begin
  if v_uid is null or not public.artessencia_is_owner_v1() then
    raise exception 'store owner required';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected revision required';
  end if;
  if jsonb_typeof(p_zones) is distinct from 'array' then
    raise exception 'invalid zones';
  end if;
  if jsonb_array_length(p_zones) > 100 then
    raise exception 'too many zones';
  end if;

  -- Ordem de bloqueio partilhada com a proposta v2: state, depois settings.
  select revision, coalesce(data #> '{settings,shopDelivery}','{}'::jsonb)
    into v_revision,v_main from public.artessencia_v1_state
    where user_id=v_uid for update;
  if not found or v_revision is distinct from p_expected_revision then
    raise exception 'cloud_revision_conflict';
  end if;
  select coalesce(data->'delivery','{}'::jsonb)
    into v_shop from public.artessencia_shop_settings
    where user_id=v_uid for update;
  if not found then raise exception 'shop settings missing'; end if;
  if v_shop is distinct from v_main then raise exception 'delivery sources diverged'; end if;
  if v_shop #>> '{deliveryZoneConfig,enabled}' = 'true' then
    raise exception 'active zones cannot be overwritten by draft';
  end if;

  for v_zone in select value from jsonb_array_elements(p_zones) loop
    if jsonb_typeof(v_zone) is distinct from 'object' then raise exception 'invalid zone'; end if;
    if jsonb_typeof(v_zone->'name') is distinct from 'string' then raise exception 'invalid locality'; end if;
    v_name := nullif(btrim(v_zone->>'name'),'');
    if v_name is null or length(v_name)>100 then raise exception 'invalid locality'; end if;
    if lower(v_name)=any(v_seen_names) then raise exception 'duplicate locality'; end if;
    v_seen_names:=array_append(v_seen_names,lower(v_name));
    if jsonb_typeof(v_zone->'enabled') is distinct from 'boolean' then raise exception 'invalid zone state'; end if;

    if jsonb_typeof(v_zone->'feeCents') is distinct from 'number' then raise exception 'invalid fee'; end if;
    v_fee_text := v_zone->>'feeCents';
    if length(v_fee_text)>8 or v_fee_text !~ '^[0-9]+$' then raise exception 'invalid fee'; end if;
    if v_fee_text::bigint>10000000 then raise exception 'fee out of range'; end if;

    if jsonb_typeof(v_zone->'postalCodes') is distinct from 'array' then raise exception 'postal codes required'; end if;
    if jsonb_array_length(v_zone->'postalCodes') not between 1 and 1000 then raise exception 'postal codes limit'; end if;
    for v_code_value in select value from jsonb_array_elements(v_zone->'postalCodes') loop
      if jsonb_typeof(v_code_value) is distinct from 'string' then raise exception 'invalid postal code type'; end if;
      v_code:=v_code_value #>> '{}';
      if v_code !~ '^[0-9]{4}-[0-9]{3}$' then raise exception 'invalid postal code'; end if;
      if v_code=any(v_seen_codes) then raise exception 'duplicate postal code'; end if;
      v_seen_codes:=array_append(v_seen_codes,v_code);
      v_total_codes:=v_total_codes+1;
      if v_total_codes>5000 then raise exception 'too many postal codes'; end if;
    end loop;
  end loop;

  v_draft:=jsonb_build_object('enabled',false,'headquarters','Castelejo','zones',p_zones);
  update public.artessencia_shop_settings
    set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_shop||jsonb_build_object('deliveryZoneConfig',v_draft),true),
        updated_at=now()
    where user_id=v_uid;
  update public.artessencia_v1_state
    set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_main||jsonb_build_object('deliveryZoneConfig',v_draft),true),
        revision=revision+1,updated_at=now()
    where user_id=v_uid;
  return v_revision+1;
end;
$function$;
-- NÃO EXECUTAR EM PRODUÇÃO.
