-- ISOLATED TEST PROJECT ONLY. Does not authorize paid production or enable trial.
BEGIN;
DO $guard$ BEGIN
 IF to_regclass('artessencia_intelligence_private.worker_service_binding') IS NULL
 OR (SELECT count(*) FROM artessencia_intelligence_private.worker_service_binding)<>1
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.worker_service_binding WHERE enabled)
 OR (SELECT count(*) FROM artessencia_intelligence_private.simulation_release)<>1
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release WHERE enabled)
 OR NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton AND NOT release_enabled AND NOT frozen AND monthly_limit_microeur=2000000)
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE model<>'artessencia-simulation-v1' OR status<>'settled' OR actual_microeur IS DISTINCT FROM 0)
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_missions WHERE status NOT IN ('review_ready','cancelled'))
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_routines WHERE enabled)
 THEN RAISE EXCEPTION 'UNSAFE_REAL_TRIAL_FIXTURE'; END IF;
END $guard$;
CREATE TABLE artessencia_intelligence_private.trial_release(
 user_id uuid PRIMARY KEY,enabled boolean NOT NULL DEFAULT false,
 approved_at timestamptz,expires_at timestamptz,
 CHECK(NOT enabled OR (approved_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>approved_at AND expires_at<=approved_at+interval '24 hours'))
);
ALTER TABLE artessencia_intelligence_private.trial_release ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.trial_release FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;
INSERT INTO artessencia_intelligence_private.trial_release(user_id) SELECT owner_id FROM artessencia_intelligence_private.worker_service_binding;
UPDATE artessencia_intelligence_private.ai_budget_control SET monthly_limit_microeur=1000000 WHERE singleton;
CREATE FUNCTION artessencia_intelligence_private.isolated_trial_allowed(p_model text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $allowed$
 SELECT coalesce(p_model='gpt-5.4-mini-2026-03-17'
 AND auth.jwt()->>'role'='artessencia_intelligence_worker'
 AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.worker_service_binding b
 JOIN artessencia_intelligence_private.trial_release t ON t.user_id=b.owner_id
 JOIN artessencia_intelligence_private.simulation_release s ON s.user_id=b.owner_id
 JOIN artessencia_intelligence_private.team_controls c ON c.user_id=b.owner_id
 WHERE b.owner_id=auth.uid() AND b.enabled AND t.enabled AND NOT s.enabled
 AND t.approved_at<=clock_timestamp() AND t.expires_at>clock_timestamp() AND c.enabled
 AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(c.modes) AS m WHERE m.value NOT IN ('manual','off'))
 AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=b.owner_id AND r.enabled))
 AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton AND NOT release_enabled AND NOT frozen AND monthly_limit_microeur<=1000000),false);
$allowed$;
CREATE FUNCTION artessencia_intelligence_private.isolated_trial_used()
RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path='' AS $used$
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' THEN actual_microeur ELSE 0 END),0)
 FROM artessencia_intelligence_private.ai_budget_entries WHERE model='gpt-5.4-mini-2026-03-17';
$used$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.isolated_trial_allowed(text),artessencia_intelligence_private.isolated_trial_used() FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_reserve(p_id uuid,p_channel text,p_model text,p_max bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $reserve$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; m date; used numeric; stamp timestamptz;
BEGIN
 IF p_id IS NULL OR p_channel IS NULL OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 23000000 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR c.release_enabled OR c.frozen OR NOT (artessencia_intelligence_private.isolated_simulation_budget_allowed(p_model) OR artessencia_intelligence_private.isolated_trial_allowed(p_model)) THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 stamp:=clock_timestamp();m:=date_trunc('month',stamp AT TIME ZONE 'Europe/Lisbon')::date;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id) THEN RAISE EXCEPTION 'DUPLICATE_REQUEST'; END IF;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used+p_max>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 IF p_model='gpt-5.4-mini-2026-03-17' AND artessencia_intelligence_private.isolated_trial_used()+p_max>1000000 THEN RAISE EXCEPTION 'TRIAL_LIFETIME_LIMIT'; END IF;
 INSERT INTO artessencia_intelligence_private.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status)
 VALUES(p_id,p_channel,p_model,p_max,stamp,m,'reserved');
 RETURN jsonb_build_object('requestId',p_id,'maximumMicroeur',p_max,'remainingMicroeur',least(c.monthly_limit_microeur-used-p_max,CASE WHEN p_model='gpt-5.4-mini-2026-03-17' THEN 1000000-artessencia_intelligence_private.isolated_trial_used() ELSE c.monthly_limit_microeur END),'status','reserved');
END;
$reserve$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_claim(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; used numeric;
BEGIN
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id AND status='reserved' FOR UPDATE;
 IF NOT FOUND OR NOT (artessencia_intelligence_private.isolated_simulation_budget_allowed(e.model) OR artessencia_intelligence_private.isolated_trial_allowed(e.model)) THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 IF e.model='gpt-5.4-mini-2026-03-17' AND artessencia_intelligence_private.isolated_trial_used()>1000000 THEN RAISE EXCEPTION 'TRIAL_LIFETIME_LIMIT'; END IF;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status='inflight' WHERE request_id=p_id AND status='reserved' RETURNING * INTO e;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_CLAIMABLE'; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status','inflight','model',e.model,'maximumMicroeur',e.maximum_microeur);
END;
$claim$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_settle(p_id uuid,p_actual bigint,p_evidence text,p_no_charge boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $settle$
DECLARE e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; new_status text;
BEGIN
 IF p_actual IS NULL OR p_actual<0 OR p_evidence IS NULL OR length(trim(p_evidence)) NOT BETWEEN 1 AND 200 OR p_no_charge IS NULL OR (p_no_charge AND p_actual<>0) THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_UNAVAILABLE'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT (e.status IN ('inflight','unknown') OR (e.status='reserved' AND p_no_charge)) THEN RAISE EXCEPTION 'REQUEST_NOT_SETTLEABLE'; END IF;
 IF e.model='artessencia-simulation-v1' THEN
  IF p_actual<>0 THEN RAISE EXCEPTION 'SIMULATION_ZERO_COST_REQUIRED'; END IF;
 ELSIF e.model<>'gpt-5.4-mini-2026-03-17' OR auth.jwt()->>'role' IS DISTINCT FROM 'artessencia_intelligence_worker' THEN
  RAISE EXCEPTION 'TRIAL_SETTLEMENT_DENIED';
 END IF;
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 new_status:=CASE WHEN p_no_charge THEN 'void' ELSE 'settled' END;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status=new_status,actual_microeur=p_actual,settled_month=m,evidence_ref=p_evidence WHERE request_id=p_id;
 IF p_actual>e.maximum_microeur THEN UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=true,release_enabled=false WHERE singleton=true; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status',new_status,'actualMicroeur',p_actual,'overrun',p_actual>e.maximum_microeur);
END;
$settle$;

CREATE OR REPLACE FUNCTION public.artessencia_intelligence_service_v1(p_action text,p_args jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $service$
DECLARE
 actor uuid:=auth.uid(); binding artessencia_intelligence_private.worker_service_binding%rowtype;
 old_sub text:=current_setting('request.jwt.claim.sub',true);
 old_claims text:=current_setting('request.jwt.claims',true);
 result jsonb; trial boolean; sim boolean;
BEGIN
 SELECT * INTO binding FROM artessencia_intelligence_private.worker_service_binding WHERE service_id=actor AND enabled;
 IF NOT FOUND OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SERVICE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id::text=auth.jwt()->>'session_id' AND s.user_id=actor AND (s.not_after IS NULL OR s.not_after>clock_timestamp())) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SERVICE_SESSION_REQUIRED'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('identity','simulation_identity','trial_identity','tick','next','claim_run','status','finish','input','stock','director','department','reserve','claim_charge','permission','unknown','settle') THEN RAISE EXCEPTION 'INVALID_SERVICE_ACTION'; END IF;

 PERFORM set_config('request.jwt.claim.sub',binding.owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',binding.owner_id,'role','artessencia_intelligence_worker')::text,true);
 BEGIN
  trial:=artessencia_intelligence_private.isolated_trial_allowed('gpt-5.4-mini-2026-03-17');
  sim:=artessencia_intelligence_private.isolated_simulation_budget_allowed('artessencia-simulation-v1');
  IF p_action='trial_identity' THEN result:=to_jsonb(trial);
  ELSE
   IF p_action NOT IN ('identity','simulation_identity') AND NOT (trial OR sim) THEN RAISE EXCEPTION 'ISOLATED_EXECUTION_DISABLED'; END IF;
   IF trial AND (p_action IN ('tick','next') OR (p_action IN ('reserve','claim_charge','permission') AND (p_args->>'mission' IS NULL OR p_args->>'channel' LIKE 'legacy_%'))) THEN RAISE EXCEPTION 'TRIAL_MANUAL_ONLY'; END IF;
   IF p_action='reserve' AND (CASE WHEN trial THEN p_args->>'model' IS DISTINCT FROM 'gpt-5.4-mini-2026-03-17' ELSE p_args->>'model' IS DISTINCT FROM 'artessencia-simulation-v1' END) THEN RAISE EXCEPTION 'ISOLATED_MODEL_DENIED'; END IF;
   IF trial AND p_action IN ('unknown','settle') AND NOT EXISTS(
    SELECT 1 FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.ai_budget_entries e USING(request_id)
    WHERE r.user_id=binding.owner_id AND r.request_id=(p_args->>'request')::uuid AND e.model='gpt-5.4-mini-2026-03-17'
   ) THEN RAISE EXCEPTION 'TRIAL_RECEIPT_SCOPE'; END IF;
   result:=public.artessencia_intelligence_worker_v1(p_action,p_args);
  END IF;
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
