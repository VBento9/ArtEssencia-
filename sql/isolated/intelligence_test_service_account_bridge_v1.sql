-- Historical migration 20261127021538. Isolated test project only.
BEGIN;
DO $guard$ BEGIN
 IF (SELECT count(*) FROM auth.users)<>2 OR (SELECT count(*) FROM auth.users WHERE id IN ('73fe5720-6e36-4e82-a223-d941ffc6cbe4','4aac167d-3ecd-4f18-b659-4c39d0cd68c5') AND email_confirmed_at IS NOT NULL)<>2 OR NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_controls WHERE user_id='73fe5720-6e36-4e82-a223-d941ffc6cbe4' AND NOT enabled) OR (SELECT release_enabled FROM artessencia_intelligence_private.ai_budget_control) THEN RAISE EXCEPTION 'UNSAFE_FIXTURE'; END IF;
END $guard$;
CREATE TABLE artessencia_intelligence_private.worker_service_binding(
 service_id uuid PRIMARY KEY REFERENCES auth.users(id), owner_id uuid NOT NULL REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false, CHECK(service_id<>owner_id)
);
ALTER TABLE artessencia_intelligence_private.worker_service_binding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.worker_service_binding FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;
INSERT INTO artessencia_intelligence_private.worker_service_binding(service_id,owner_id) VALUES('4aac167d-3ecd-4f18-b659-4c39d0cd68c5','73fe5720-6e36-4e82-a223-d941ffc6cbe4');
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
 IF p_action IS NULL OR p_action NOT IN ('identity','simulation_identity','tick','next','claim_run','status','finish','input','stock','director','department','reserve','claim_charge','permission','unknown','settle') THEN RAISE EXCEPTION 'INVALID_SERVICE_ACTION'; END IF;
 IF p_action NOT IN ('identity','simulation_identity') AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release WHERE user_id=binding.owner_id AND enabled) THEN RAISE EXCEPTION 'SIMULATION_DISABLED'; END IF;
 IF p_action='reserve' AND p_args->>'model' IS DISTINCT FROM 'artessencia-simulation-v1' THEN RAISE EXCEPTION 'REAL_MODEL_DISABLED_IN_SIMULATION'; END IF;
 PERFORM set_config('request.jwt.claim.sub',binding.owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',binding.owner_id,'role','artessencia_intelligence_worker')::text,true);
 BEGIN
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
