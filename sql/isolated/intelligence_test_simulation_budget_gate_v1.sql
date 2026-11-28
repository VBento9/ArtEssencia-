-- ISOLATED FIXTURE ONLY. Never apply this migration to production.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('artessencia_intelligence_private.worker_service_binding') IS NULL
 OR (SELECT count(*) FROM artessencia_intelligence_private.worker_service_binding)<>1
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.worker_service_binding WHERE enabled)
 OR (SELECT count(*) FROM artessencia_intelligence_private.simulation_release)<>1
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release WHERE enabled)
 OR NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton AND NOT release_enabled AND NOT frozen)
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries)
 THEN RAISE EXCEPTION 'UNSAFE_ISOLATED_FIXTURE'; END IF;
END $guard$;
CREATE FUNCTION artessencia_intelligence_private.isolated_simulation_budget_allowed(p_model text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $allowed$
 SELECT coalesce(p_model='artessencia-simulation-v1'
 AND auth.jwt()->>'role'='artessencia_intelligence_worker'
 AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.worker_service_binding b
 JOIN artessencia_intelligence_private.simulation_release s ON s.user_id=b.owner_id
 WHERE b.owner_id=auth.uid() AND b.enabled AND s.enabled),false);
$allowed$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.isolated_simulation_budget_allowed(text) FROM PUBLIC,anon,authenticated,service_role,artessencia_intelligence_worker;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_reserve(p_id uuid,p_channel text,p_model text,p_max bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $reserve$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; m date; used numeric; stamp timestamptz;
BEGIN
 IF p_id IS NULL OR p_channel IS NULL OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 23000000 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR c.release_enabled OR c.frozen OR NOT artessencia_intelligence_private.isolated_simulation_budget_allowed(p_model) THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 stamp:=clock_timestamp();m:=date_trunc('month',stamp AT TIME ZONE 'Europe/Lisbon')::date;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id) THEN RAISE EXCEPTION 'DUPLICATE_REQUEST'; END IF;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used+p_max>23000000 THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 INSERT INTO artessencia_intelligence_private.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status)
 VALUES(p_id,p_channel,p_model,p_max,stamp,m,'reserved');
 RETURN jsonb_build_object('requestId',p_id,'maximumMicroeur',p_max,'remainingMicroeur',23000000-used-p_max,'status','reserved');
END;
$reserve$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_claim(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; e artessencia_intelligence_private.ai_budget_entries%rowtype;
BEGIN
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id AND status='reserved' FOR UPDATE;
 IF NOT FOUND OR NOT artessencia_intelligence_private.isolated_simulation_budget_allowed(e.model) THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
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
 IF e.model IS DISTINCT FROM 'artessencia-simulation-v1' OR p_actual<>0 THEN RAISE EXCEPTION 'SIMULATION_ZERO_COST_REQUIRED'; END IF;
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 new_status:=CASE WHEN p_no_charge THEN 'void' ELSE 'settled' END;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status=new_status,actual_microeur=p_actual,settled_month=m,evidence_ref=p_evidence WHERE request_id=p_id;
 IF p_actual>e.maximum_microeur THEN UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=true,release_enabled=false WHERE singleton=true; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status',new_status,'actualMicroeur',p_actual,'overrun',p_actual>e.maximum_microeur);
END;
$settle$;
COMMIT;
