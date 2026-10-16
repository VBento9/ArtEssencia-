-- ArtEssencia: owner-only zone write and backward-compatible existing delivery settings save.
-- This migration does not create zones, modify fulfillment flags or enable the store.
CREATE OR REPLACE FUNCTION public.artessencia_save_shop_delivery_v1(p_shop_delivery jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid;
begin
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'authentication required'; end if;
  if not public.artessencia_is_owner_v1() then
    raise exception 'store owner required';
  end if;

  insert into public.artessencia_shop_settings(user_id,data,updated_at)
  values(v_uid,jsonb_build_object('delivery',coalesce(p_shop_delivery,'{}'::jsonb) - 'zones'),now())
  on conflict(user_id) do update
  set data=jsonb_set(
        coalesce(public.artessencia_shop_settings.data,'{}'::jsonb),
        '{delivery}',
        (coalesce(p_shop_delivery,'{}'::jsonb) - 'zones') ||
        case when jsonb_typeof(public.artessencia_shop_settings.data #> '{delivery,zones}')='array'
          then jsonb_build_object('zones',public.artessencia_shop_settings.data #> '{delivery,zones}')
          else '{}'::jsonb end,
        true
      ),
      updated_at=now();

  update public.artessencia_v1_state
  set data=jsonb_set(
        coalesce(data,'{}'::jsonb),
        '{settings,shopDelivery}',
        coalesce(p_shop_delivery,'{}'::jsonb) - 'zones',
        true
      ),
      revision=coalesce(revision,0)+1,
      updated_at=now()
  where user_id=v_uid;

  insert into public.store_settings(key,value,updated_at)
  values(
    'fulfillment',
    jsonb_build_object(
      'pickup_enabled',coalesce((p_shop_delivery->>'pickupEnabled')::boolean,false),
      'delivery_enabled',coalesce((p_shop_delivery->>'localDeliveryEnabled')::boolean,false)
    ),
    now()
  )
  on conflict(key) do update
  set value=excluded.value,updated_at=now();

  if not (
    coalesce((p_shop_delivery->>'pickupEnabled')::boolean,false)
    or coalesce((p_shop_delivery->>'localDeliveryEnabled')::boolean,false)
  ) then
    update public.store_settings
    set value=coalesce(value,'{}'::jsonb) || jsonb_build_object('accepting_orders',false),
        updated_at=now()
    where key='store_status';
  end if;

  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.artessencia_update_delivery_zones_v1(p_zones jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
 v_uid uuid := auth.uid();
 v_saved jsonb;
BEGIN
 IF v_uid IS NULL OR NOT public.artessencia_is_owner_v1() THEN
  RAISE EXCEPTION 'not authorized';
 END IF;
 IF jsonb_typeof(p_zones) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'invalid delivery zones';
 END IF;
 IF jsonb_array_length(p_zones)>100 THEN RAISE EXCEPTION 'too many zones'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_zones) AS x(zone)
  WHERE jsonb_typeof(x.zone) IS DISTINCT FROM 'object'
    OR jsonb_typeof(x.zone->'locality') IS DISTINCT FROM 'string'
    OR length(trim(coalesce(x.zone->>'locality',''))) NOT BETWEEN 1 AND 100
    OR jsonb_typeof(x.zone->'active') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(x.zone->'postal_codes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(x.zone->'fee_cents') IS DISTINCT FROM 'number'
    OR coalesce(x.zone->>'fee_cents','') !~ '^(0|[1-9][0-9]{0,6})$'
 ) THEN RAISE EXCEPTION 'invalid zone entry'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_zones) AS x(zone)
  WHERE CASE WHEN jsonb_typeof(x.zone->'postal_codes')='array' THEN jsonb_array_length(x.zone->'postal_codes') NOT BETWEEN 1 AND 100 ELSE true END
 ) THEN RAISE EXCEPTION 'invalid number of postal codes'; END IF;
 IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(p_zones) AS x(zone)
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(x.zone->'postal_codes')='array' THEN x.zone->'postal_codes' ELSE '[]'::jsonb END) AS c(code)
  WHERE jsonb_typeof(c.code) IS DISTINCT FROM 'string'
     OR (c.code #>> '{}') !~ '^[0-9]{4}-[0-9]{3}$'
 ) THEN RAISE EXCEPTION 'invalid postal code'; END IF;
 IF EXISTS (
  SELECT 1 FROM (
   SELECT lower(trim(x.zone->>'locality')) AS locality,
          c.code #>> '{}' AS postal_code, count(*) AS n
   FROM jsonb_array_elements(p_zones) AS x(zone)
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(x.zone->'postal_codes')='array' THEN x.zone->'postal_codes' ELSE '[]'::jsonb END) AS c(code)
   WHERE x.zone->>'active'='true'
   GROUP BY 1,2 HAVING count(*)>1
  ) duplicates
 ) THEN RAISE EXCEPTION 'duplicate active delivery zone'; END IF;
 UPDATE public.artessencia_shop_settings
 SET data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery}',
      (case when jsonb_typeof(data->'delivery')='object' then data->'delivery' else '{}'::jsonb end)
      || jsonb_build_object('zones',p_zones),true),
     updated_at=now()
 WHERE user_id=v_uid
 RETURNING data->'delivery'->'zones' INTO v_saved;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner settings unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'zones',v_saved);
END
$fn$;
REVOKE ALL ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) TO authenticated;
