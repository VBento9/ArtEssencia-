-- ARTESSENCIA / PROPOSTA NÃO EXECUTADA
-- Não aplicar enquanto artessencia_save_shop_delivery_v1 e o cloud push geral
-- não preservarem deliveryZoneConfig perante gravações concorrentes.
-- Contrato SQL transacional para atualização APENAS do rascunho das zonas.

create or replace function public.artessencia_save_delivery_zone_draft_v1(
  p_expected_revision bigint,
  p_zones jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_current_rev bigint;
  v_shop_delivery jsonb;
  v_state_delivery jsonb;
  v_zone jsonb;
  v_code text;
  v_code_json jsonb;
  v_codes text[] := array[]::text[];
  v_name text;
  v_names text[] := array[]::text[];
  v_fee bigint;
  v_new jsonb;
  v_code_count integer := 0;
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
    raise exception 'invalid zones';
  end if;

  -- Serializa gravações que cooperam com o lock desta linha.
  select revision, coalesce(data #> '{settings,shopDelivery}', '{}'::jsonb)
  into v_current_rev, v_state_delivery
  from public.artessencia_v1_state
  where user_id = v_uid
  for update;
  if not found or v_current_rev is distinct from p_expected_revision then
    raise exception 'delivery draft conflict: reload settings';
  end if;

  select coalesce(data->'delivery','{}'::jsonb) into v_shop_delivery
  from public.artessencia_shop_settings
  where user_id = v_uid
  for update;
  if not found then raise exception 'shop delivery settings missing'; end if;

  -- Evita sincronizar divergências já existentes.
  if v_shop_delivery is distinct from v_state_delivery then
    raise exception 'shop delivery sources diverged: reload before saving';
  end if;
  -- Um rascunho não pode substituir zonas já ativadas pela Loja.
  if (v_shop_delivery #>> '{deliveryZoneConfig,enabled}') = 'true' then
    raise exception 'active delivery zones require manual migration';
  end if;

  for v_zone in select value from jsonb_array_elements(p_zones) loop
    if jsonb_typeof(v_zone) is distinct from 'object' then raise exception 'invalid zone'; end if;
    v_name := nullif(btrim(v_zone->>'name'), '');
    if v_name is null or length(v_name) > 100 then raise exception 'invalid locality'; end if;
    if lower(v_name) = any(v_names) then raise exception 'duplicate locality'; end if;
    v_names := array_append(v_names,lower(v_name));
    if jsonb_typeof(v_zone->'enabled') is distinct from 'boolean' then raise exception 'invalid zone enabled'; end if;
    if jsonb_typeof(v_zone->'feeCents') is distinct from 'number' or (v_zone->>'feeCents') !~ '^[0-9]+
      raise exception 'invalid fee';
    end if;
    v_fee := (v_zone->>'feeCents')::bigint;
    if v_fee > 10000000 then raise exception 'fee out of range'; end if;
    if jsonb_typeof(v_zone->'postalCodes') is distinct from 'array' then
      raise exception 'zone postal codes required';
    end if;
    if jsonb_array_length(v_zone->'postalCodes') = 0 then
      raise exception 'zone postal codes required';
    end if;
    if jsonb_array_length(v_zone->'postalCodes') > 1000 then raise exception 'too many postal codes'; end if;
    for v_code_json in select value from jsonb_array_elements(v_zone->'postalCodes') loop
      if jsonb_typeof(v_code_json) is distinct from 'string' then raise exception 'invalid postal code type'; end if;
      v_code := v_code_json #>> '{}';
      v_code_count := v_code_count + 1;
      if v_code_count > 5000 then raise exception 'too many postal codes overall'; end if;
      -- Formato canónico guardado na Cloud; o editor normaliza previamente.
      if v_code !~ '^[0-9]{4}-[0-9]{3}
      if v_code = any(v_codes) then raise exception 'duplicate postal code'; end if;
      v_codes := array_append(v_codes,v_code);
    end loop;
  end loop;

  v_new := jsonb_build_object(
    'enabled',false,
    'headquarters','Castelejo',
    'zones',p_zones
  );

  update public.artessencia_shop_settings
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_shop_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      updated_at=now()
  where user_id=v_uid;

  update public.artessencia_v1_state
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_state_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      revision=revision+1,updated_at=now()
  where user_id=v_uid;

  return v_current_rev+1;
end;
$$;

-- NÃO EXECUTAR: confirmar política EXECUTE e atualizar gravação geral primeiro.
 then raise exception 'invalid postal code'; end if;
      if v_code = any(v_codes) then raise exception 'duplicate postal code'; end if;
      v_codes := array_append(v_codes,v_code);
    end loop;
  end loop;

  v_new := jsonb_build_object(
    'enabled',false,
    'headquarters','Castelejo',
    'zones',p_zones
  );

  update public.artessencia_shop_settings
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_shop_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      updated_at=now()
  where user_id=v_uid;

  update public.artessencia_v1_state
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_state_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      revision=revision+1,updated_at=now()
  where user_id=v_uid;

  return v_current_rev+1;
end;
$$;

-- NÃO EXECUTAR: confirmar política EXECUTE e atualizar gravação geral primeiro.
 then
      raise exception 'invalid fee';
    end if;
    v_fee := (v_zone->>'feeCents')::bigint;
    if v_fee > 10000000 then raise exception 'fee out of range'; end if;
    if jsonb_typeof(v_zone->'postalCodes') <> 'array' or jsonb_array_length(v_zone->'postalCodes') = 0 then
      raise exception 'zone postal codes required';
    end if;
    if jsonb_array_length(v_zone->'postalCodes') > 1000 then raise exception 'too many postal codes'; end if;
    for v_code_json in select value from jsonb_array_elements(v_zone->'postalCodes') loop
      if jsonb_typeof(v_code_json) is distinct from 'string' then raise exception 'invalid postal code type'; end if;
      v_code := v_code_json #>> '{}';
      v_code_count := v_code_count + 1;
      if v_code_count > 5000 then raise exception 'too many postal codes overall'; end if;
      -- Formato canónico guardado na Cloud; o editor normaliza previamente.
      if v_code !~ '^[0-9]{4}-[0-9]{3}
      if v_code = any(v_codes) then raise exception 'duplicate postal code'; end if;
      v_codes := array_append(v_codes,v_code);
    end loop;
  end loop;

  v_new := jsonb_build_object(
    'enabled',false,
    'headquarters','Castelejo',
    'zones',p_zones
  );

  update public.artessencia_shop_settings
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_shop_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      updated_at=now()
  where user_id=v_uid;

  update public.artessencia_v1_state
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_state_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      revision=revision+1,updated_at=now()
  where user_id=v_uid;

  return v_current_rev+1;
end;
$$;

-- NÃO EXECUTAR: confirmar política EXECUTE e atualizar gravação geral primeiro.
 then raise exception 'invalid postal code'; end if;
      if v_code = any(v_codes) then raise exception 'duplicate postal code'; end if;
      v_codes := array_append(v_codes,v_code);
    end loop;
  end loop;

  v_new := jsonb_build_object(
    'enabled',false,
    'headquarters','Castelejo',
    'zones',p_zones
  );

  update public.artessencia_shop_settings
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',v_shop_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      updated_at=now()
  where user_id=v_uid;

  update public.artessencia_v1_state
  set data=jsonb_set(coalesce(data,'{}'::jsonb),'{settings,shopDelivery}',v_state_delivery || jsonb_build_object('deliveryZoneConfig',v_new),true),
      revision=revision+1,updated_at=now()
  where user_id=v_uid;

  return v_current_rev+1;
end;
$$;

-- NÃO EXECUTAR: confirmar política EXECUTE e atualizar gravação geral primeiro.
