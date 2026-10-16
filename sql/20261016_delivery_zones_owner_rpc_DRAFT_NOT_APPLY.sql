-- DRAFT, REVIEW ONLY. Do not apply to production before integration review.
-- The authenticated owner alone may edit delivery zones; independent of shop open/closed status.
-- No new tables: preserve all other keys in artessencia_shop_settings.data.
CREATE OR REPLACE FUNCTION public.artessencia_update_delivery_zones_v1(p_zones jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid:=auth.uid(); v_record jsonb; v_exists boolean;
BEGIN
 IF v_uid IS NULL OR NOT public.artessencia_is_owner_v1() THEN
   RAISE EXCEPTION 'not authorized';
 END IF;
 IF jsonb_typeof(p_zones)<>'array' OR jsonb_array_length(p_zones)>100 THEN
   RAISE EXCEPTION 'invalid delivery zones';
 END IF;
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_zones) z
   WHERE jsonb_typeof(z)<>'object'
     OR length(trim(coalesce(z->>'locality',''))) NOT BETWEEN 1 AND 100
     OR jsonb_typeof(z->'postal_codes')<>'array'
     OR jsonb_array_length(z->'postal_codes')=0
     OR (z->>'fee_cents') !~ '^[0-9]{1,7}$'
     OR jsonb_typeof(z->'active')<>'boolean'
 ) THEN RAISE EXCEPTION 'invalid zone entry'; END IF;
 -- NOTE: server-side postcode uniqueness, ownership model and data shape
 -- must still be fully reviewed before any migration is run.
 UPDATE public.artessencia_shop_settings
 SET data=jsonb_set(coalesce(data,'{}'::jsonb),'{delivery,zones}',p_zones,true),
     updated_at=now()
 WHERE user_id=v_uid
 RETURNING data->'delivery'->'zones' INTO v_record;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner settings unavailable'; END IF;
 RETURN jsonb_build_object('ok',true,'zones',v_record);
END; $$;
REVOKE ALL ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_update_delivery_zones_v1(jsonb) TO authenticated;
-- Not ready for execution: perform PostgreSQL validation and authorization review.
