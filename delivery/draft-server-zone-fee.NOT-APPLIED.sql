-- ArtEssencia: draft only, not applied to PostgreSQL.
-- Public EXECUTE must be revoked before any future deployment.
create or replace function public.artessencia_quote_zone_fee_draft(
  p_postal_code text, p_delivery jsonb
) returns bigint
language plpgsql security invoker set search_path=public
as $function$
declare
  v_config jsonb;
  v_zone jsonb;
  v_code_value jsonb;
  v_seen text[] := array[]::text[];
  v_postal text;
  v_code text;
  v_name text;
  v_seen_names text[] := array[]::text[];
  v_fee_text text;
  v_fee bigint;
  v_result bigint;
  v_matched integer := 0;
  v_code_count integer := 0;
begin
  if jsonb_typeof(p_delivery) is distinct from 'object' then
    raise exception 'invalid delivery config';
  end if;
  if p_delivery->>'localDeliveryEnabled' is distinct from 'true' then
    raise exception 'delivery disabled';
  end if;
  v_config := p_delivery->'deliveryZoneConfig';
  if jsonb_typeof(v_config) is distinct from 'object'
     or v_config->>'enabled' is distinct from 'true' then
    raise exception 'zones disabled';
  end if;
  v_postal := btrim(coalesce(p_postal_code,''));
  if v_postal !~ '^[0-9]{4}-[0-9]{3}$' then
    raise exception 'invalid postal';
  end if;
  if jsonb_typeof(v_config->'zones') is distinct from 'array' then
    raise exception 'invalid zones';
  end if;
  if jsonb_array_length(v_config->'zones') > 100 then
    raise exception 'too many zones';
  end if;
  for v_zone in select value from jsonb_array_elements(v_config->'zones') loop
    if jsonb_typeof(v_zone) is distinct from 'object'
       or jsonb_typeof(v_zone->'enabled') is distinct from 'boolean'
       or jsonb_typeof(v_zone->'postalCodes') is distinct from 'array'
       or jsonb_array_length(v_zone->'postalCodes') not between 1 and 1000 then
      raise exception 'invalid zone';
    end if;
    if jsonb_typeof(v_zone->'name') is distinct from 'string' then
      raise exception 'invalid zone name';
    end if;
    v_name := nullif(btrim(v_zone->>'name'),'');
    if v_name is null or length(v_name)>100 then
      raise exception 'invalid zone name';
    end if;
    if lower(v_name)=any(v_seen_names) then
      raise exception 'duplicate zone name';
    end if;
    v_seen_names := array_append(v_seen_names,lower(v_name));
    v_fee_text := v_zone->>'feeCents';
    if jsonb_typeof(v_zone->'feeCents') is distinct from 'number'
       or length(coalesce(v_fee_text,'')) > 8
       or v_fee_text !~ '^[0-9]+
      if jsonb_typeof(v_code_value) is distinct from 'string' then
        raise exception 'invalid postal type';
      end if;
      v_code := v_code_value #>> '{}';
      if v_code !~ '^[0-9]{4}-[0-9]{3}$' then
        raise exception 'invalid zone postal';
      end if;
      if v_code = any(v_seen) then
        raise exception 'duplicate postal code';
      end if;
      v_seen := array_append(v_seen,v_code);
      v_code_count := v_code_count + 1;
      if v_code_count > 5000 then
        raise exception 'too many postal codes';
      end if;
    end loop;
    if v_zone->>'enabled' = 'true' and v_zone->'postalCodes' ? v_postal then
      v_matched := v_matched + 1;
      v_result := v_fee;
    end if;
  end loop;
  if v_matched <> 1 then
    raise exception 'postal not assigned to one active zone';
  end if;
  return v_result;
end;
$function$;
-- NOT APPLIED. No authorization to use in production.
 then
      raise exception 'invalid zone fee';
    end if;
    v_fee := v_fee_text::bigint;
    if v_fee > 10000000 then raise exception 'fee out of range'; end if;
    for v_code_value in select value from jsonb_array_elements(v_zone->'postalCodes') loop
      if jsonb_typeof(v_code_value) is distinct from 'string' then
        raise exception 'invalid postal type';
      end if;
      v_code := v_code_value #>> '{}';
      if v_code !~ '^[0-9]{4}-[0-9]{3}$' then
        raise exception 'invalid zone postal';
      end if;
      if v_code = any(v_seen) then
        raise exception 'duplicate postal code';
      end if;
      v_seen := array_append(v_seen,v_code);
      v_code_count := v_code_count + 1;
      if v_code_count > 5000 then
        raise exception 'too many postal codes';
      end if;
    end loop;
    if v_zone->>'enabled' = 'true' and v_zone->'postalCodes' ? v_postal then
      v_matched := v_matched + 1;
      v_fee_text := v_zone->>'feeCents';
      if jsonb_typeof(v_zone->'feeCents') is distinct from 'number'
         or length(coalesce(v_fee_text,'')) > 8
         or v_fee_text !~ '^[0-9]+$' then
        raise exception 'invalid fee';
      end if;
      v_fee := v_fee_text::bigint;
      if v_fee > 10000000 then
        raise exception 'fee out of range';
      end if;
      v_result := v_fee;
    end if;
  end loop;
  if v_matched <> 1 then
    raise exception 'postal not assigned to one active zone';
  end if;
  return v_result;
end;
$function$;
-- NOT APPLIED. No authorization to use in production.
