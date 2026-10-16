-- ARTESSENCIA REVIEW DRAFT. Not applied to production.
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
    OR length(trim(coalesce(x.zone->>'locality',''))) NOT BETWEEN 1 AND 100
    OR jsonb_typeof(x.zone->'active') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(x.zone->'postal_codes') IS DISTINCT FROM 'array'
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
 SET data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery,zones}',p_zones,true),
     updated_at=now()
 WHERE user_id=v_uid
 RETURNING data->'delivery'->'zones' INTO v_saved;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner settings unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'zones',v_saved);
END
$fn$;
REVOKE ALL ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) TO authenticated;
-- Pending PostgreSQL execution tests, grants review and checkout integration.
