-- REVIEW ONLY: not deployed. Owner-only, strict zones validation.
CREATE OR REPLACE FUNCTION public.artessencia_update_delivery_zones_v1(p_zones jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
 v_uid uuid := auth.uid();
 v_saved jsonb;
BEGIN
 IF v_uid IS NULL OR NOT public.artessencia_is_owner_v1() THEN
  RAISE EXCEPTION 'not authorized';
 END IF;
 IF p_zones IS NULL OR jsonb_typeof(p_zones) <> 'array'
    OR jsonb_array_length(p_zones)>100 THEN
  RAISE EXCEPTION 'invalid delivery zones';
 END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_zones) AS z
  WHERE jsonb_typeof(z)<>'object'
   OR length(trim(coalesce(z->>'locality',''))) NOT BETWEEN 1 AND 100
   OR jsonb_typeof(z->'active') IS DISTINCT FROM 'boolean' OR (z ? 'fee_cents') IS NOT TRUE
   OR jsonb_typeof(z->'postal_codes') IS DISTINCT FROM 'array'
   OR CASE WHEN jsonb_typeof(z->'postal_codes')='array' THEN jsonb_array_length(z->'postal_codes') NOT BETWEEN 1 AND 100 ELSE true END
   OR coalesce(z->>'fee_cents','') !~ '^(0|[1-9][0-9]{0,6})$'
 ) THEN RAISE EXCEPTION 'invalid zone entry'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_zones) AS z
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(z->'postal_codes')='array' THEN z->'postal_codes' ELSE '[]'::jsonb END) AS c
  WHERE jsonb_typeof(c)<>'string'
   OR (c #>> '{}') !~ '^[0-9]{4}-[0-9]{3}
 ) THEN RAISE EXCEPTION 'invalid postal code'; END IF;
 IF EXISTS (
  SELECT 1 FROM (
   SELECT lower(trim(z->>'locality')) locality, c #>> '{}' postal_code,count(*) n
   FROM jsonb_array_elements(p_zones) z
   CROSS JOIN LATERAL jsonb_array_elements(z->'postal_codes') c
   WHERE z->>'active'='true'
   GROUP BY 1,2 HAVING count(*)>1
  ) dup
 ) THEN RAISE EXCEPTION 'duplicate active delivery zone'; END IF;
 UPDATE public.artessencia_shop_settings
 SET data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery,zones}',p_zones,true),
     updated_at=now()
 WHERE user_id=v_uid
 RETURNING data->'delivery'->'zones' INTO v_saved;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner settings unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'zones',v_saved);
END
$$;
REVOKE ALL ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) TO authenticated;
-- Must validate on isolated PostgreSQL and review actual schema/permissions prior to deployment.

 ) THEN RAISE EXCEPTION 'invalid postal code'; END IF;
 IF EXISTS (
  SELECT 1 FROM (
   SELECT lower(trim(z->>'locality')) locality, c #>> '{}' postal_code,count(*) n
   FROM jsonb_array_elements(p_zones) z
   CROSS JOIN LATERAL jsonb_array_elements(z->'postal_codes') c
   WHERE z->>'active'='true'
   GROUP BY 1,2 HAVING count(*)>1
  ) dup
 ) THEN RAISE EXCEPTION 'duplicate active delivery zone'; END IF;
 UPDATE public.artessencia_shop_settings
 SET data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery,zones}',p_zones,true),
     updated_at=now()
 WHERE user_id=v_uid
 RETURNING data->'delivery'->'zones' INTO v_saved;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner settings unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'zones',v_saved);
END
$$;
REVOKE ALL ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) TO authenticated;
-- Must validate on isolated PostgreSQL and review actual schema/permissions prior to deployment.
