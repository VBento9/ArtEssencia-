-- ARTESSENCIA — DRAFT ONLY — NEVER EXECUTE IN PRODUCTION.
-- Helper is SECURITY INVOKER: intended only for internal use by an
-- independently audited order function, not for exposing to anonymous callers.
-- This is not a migration, and has not been compiled in PostgreSQL.
create or replace function public.artessencia_quote_zone_fee_draft(
  p_postal_code text,
  p_delivery jsonb
) returns bigint
language plpgsql security invoker set search_path=public
as $function$
declare
  v_config jsonb;
  v_zones jsonb;
  v_zone jsonb;
  v_postal text;
  v_matched integer := 0;
  v_fee_text text;
  v_fee bigint;
  v_result bigint;
begin
  if jsonb_typeof(p_delivery) is distinct from 'object' then
    raise exception 'invalid delivery configuration';
  end if;
  if p_delivery->>'localDeliveryEnabled' is distinct from 'true' then
    raise exception 'delivery disabled';
  end if;
  v_config := p_delivery->'deliveryZoneConfig';
  if jsonb_typeof(v_config) is distinct from 'object' or
     v_config->>'enabled' is distinct from 'true' then
    raise exception 'zone pricing not enabled';
  end if;
  v_postal := btrim(coalesce(p_postal_code,''));
  if v_postal !~ '^[0-9]{4}-[0-9]{3}$' then
    raise exception 'invalid complete postal code';
  end if;
  v_zones := v_config->'zones';
  if jsonb_typeof(v_zones) is distinct from 'array' or
     jsonb_array_length(v_zones)>100 then
    raise exception 'invalid zone configuration';
  end if;

  for v_zone in select value from jsonb_array_elements(v_zones) loop
    if jsonb_typeof(v_zone) is distinct from 'object' then
      raise exception 'invalid zone configuration';
    end if;
    if jsonb_typeof(v_zone->'enabled') is distinct from 'boolean' then
      raise exception 'invalid zone status';
    end if;
    if jsonb_typeof(v_zone->'postalCodes') is distinct from 'array' then
      raise exception 'invalid zone postal codes';
    end if;
    if v_zone->>'enabled' = 'true'
       and v_zone->'postalCodes' ? v_postal then
      v_matched := v_matched+1;
      v_fee_text := v_zone->>'feeCents';
      if jsonb_typeof(v_zone->'feeCents') is distinct from 'number'
         or length(coalesce(v_fee_text,''))>8
         or v_fee_text !~ '^[0-9]+$' then
        raise exception 'invalid zone fee';
      end if;
      v_fee := v_fee_text::bigint;
      if v_fee>10000000 then raise exception 'zone fee out of range'; end if;
      v_result := v_fee;
    end if;
  end loop;
  if v_matched<>1 then
    raise exception 'postal code outside exactly one active delivery zone';
  end if;
  return v_result;
end;
$function$;

-- BLOCKERS BEFORE USE: revoke PUBLIC EXECUTE; verify RLS and caller grants,
-- test malicious/duplicate postal configs, align RPC v1/v2 transaction logic,
-- handle user-supplied postal code canonicalization and checkout parity.
