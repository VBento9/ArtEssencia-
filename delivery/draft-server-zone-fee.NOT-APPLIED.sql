-- ARTESSENCIA: DRAFT ONLY. DO NOT APPLY.
-- Caller must fetch trusted config server-side. No PUBLIC EXECUTE permission.
create or replace function public.artessencia_quote_zone_fee_draft(
  p_postal_code text, p_delivery jsonb
) returns bigint language plpgsql security invoker set search_path=public
as $zone$
declare
  cfg jsonb; z jsonb; item jsonb;
  postal text; code text; zone_name text; fee_str text;
  names text[] := array[]::text[];
  codes text[] := array[]::text[];
  matches integer := 0; count_codes integer := 0;
  fee bigint; answer bigint;
begin
  if jsonb_typeof(p_delivery) is distinct from 'object'
     or p_delivery->>'localDeliveryEnabled' is distinct from 'true' then
    raise exception 'delivery unavailable';
  end if;
  cfg := p_delivery->'deliveryZoneConfig';
  if jsonb_typeof(cfg) is distinct from 'object'
     or cfg->>'enabled' is distinct from 'true' then
    raise exception 'zones unavailable';
  end if;
  postal := btrim(coalesce(p_postal_code,''));
  if postal !~ '^[0-9]{4}-[0-9]{3}$' then raise exception 'invalid postal'; end if;
  if jsonb_typeof(cfg->'zones') is distinct from 'array' then
    raise exception 'invalid zones';
  end if;
  if jsonb_array_length(cfg->'zones')>100 then raise exception 'too many zones'; end if;
  for z in select value from jsonb_array_elements(cfg->'zones') loop
    if jsonb_typeof(z) is distinct from 'object'
       or jsonb_typeof(z->'name') is distinct from 'string'
       or jsonb_typeof(z->'enabled') is distinct from 'boolean'
       or jsonb_typeof(z->'postalCodes') is distinct from 'array' then
      raise exception 'invalid zone';
    end if;
    zone_name := nullif(btrim(z->>'name'),'');
    if zone_name is null or length(zone_name)>100 or lower(zone_name)=any(names) then
      raise exception 'invalid or duplicate zone name';
    end if;
    names := array_append(names,lower(zone_name));
    fee_str := z->>'feeCents';
    if jsonb_typeof(z->'feeCents') is distinct from 'number'
       or length(coalesce(fee_str,''))>8 or fee_str !~ '^[0-9]+$' then
      raise exception 'invalid zone fee';
    end if;
    fee := fee_str::bigint;
    if fee>10000000 then raise exception 'fee out of range'; end if;
    if jsonb_array_length(z->'postalCodes') not between 1 and 1000 then
      raise exception 'invalid postal count';
    end if;
    for item in select value from jsonb_array_elements(z->'postalCodes') loop
      if jsonb_typeof(item) is distinct from 'string' then
        raise exception 'invalid postal entry';
      end if;
      code := item #>> '{}';
      if code !~ '^[0-9]{4}-[0-9]{3}$' or code=any(codes) then
        raise exception 'invalid or duplicate postal code';
      end if;
      codes := array_append(codes,code);
      count_codes := count_codes+1;
      if count_codes>5000 then raise exception 'too many postal codes'; end if;
      if z->>'enabled'='true' and code=postal then
        matches := matches+1;
        answer := fee;
      end if;
    end loop;
  end loop;
  if matches<>1 then raise exception 'postal outside active delivery area'; end if;
  return answer;
end;
$zone$;
-- NOT COMPILED, NOT APPLIED. No grants authorized.
