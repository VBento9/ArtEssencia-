-- Production candidate only. No account, binding, permission or paid release
-- is enabled by this migration. Do not apply over the isolated trial bridge.
BEGIN;
CREATE TABLE artessencia_intelligence_private.worker_service_binding(
 service_id uuid PRIMARY KEY REFERENCES auth.users(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false,
 CHECK(service_id<>owner_id)
);
ALTER TABLE artessencia_intelligence_private.worker_service_binding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.worker_service_binding FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;
CREATE FUNCTION public.artessencia_intelligence_service_v1(p_action text,p_args jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $service$
DECLARE
 actor uuid:=auth.uid(); binding artessencia_intelligence_private.worker_service_binding%rowtype;
 old_sub text:=current_setting('request.jwt.claim.sub',true);
 old_claims text:=current_setting('request.jwt.claims',true);
 result jsonb;
BEGIN
 SELECT * INTO binding FROM artessencia_intelligence_private.worker_service_binding WHERE service_id=actor AND enabled;
 IF NOT FOUND OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SERVICE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id::text=auth.jwt()->>'session_id' AND s.user_id=actor AND (s.not_after IS NULL OR s.not_after>clock_timestamp())) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SERVICE_SESSION_REQUIRED'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('identity','tick','next','claim_run','status','finish','input','stock','director','department','reserve','claim_charge','permission','unknown','settle') THEN RAISE EXCEPTION 'INVALID_SERVICE_ACTION'; END IF;
 PERFORM set_config('request.jwt.claim.sub',binding.owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',binding.owner_id,'role','artessencia_intelligence_worker')::text,true);
 BEGIN
  -- Recheck ownership on every call, including after account revocation.
  IF public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  result:=public.artessencia_intelligence_worker_v1(p_action,p_args);
 EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
  RAISE;
 END;
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RETURN result;
END $service$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_service_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_service_v1(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
