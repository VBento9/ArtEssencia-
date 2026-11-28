BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$ BEGIN
 IF to_regnamespace('artessencia_intelligence_private') IS NOT NULL THEN RAISE EXCEPTION 'INTELLIGENCE_ALREADY_INSTALLED'; END IF;
 IF (SELECT count(*) FROM public.store_owner WHERE active)<>1 THEN RAISE EXCEPTION 'UNIQUE_OWNER_REQUIRED'; END IF;
END $preflight$;
-- Source: sql/intelligence-ai-budget-draft-v1.sql
-- DEVELOPMENT DRAFT. No production migration, public endpoint or application grants.
-- One shared ledger per installation, not one budget per agent or user.
CREATE SCHEMA IF NOT EXISTS artessencia_intelligence_private;
REVOKE ALL ON SCHEMA artessencia_intelligence_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.ai_budget_control(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 release_enabled boolean NOT NULL DEFAULT false,
 frozen boolean NOT NULL DEFAULT false
);
-- Administrator-only installation cap; changing it never enables paid execution.
ALTER TABLE artessencia_intelligence_private.ai_budget_control ADD COLUMN IF NOT EXISTS monthly_limit_microeur bigint NOT NULL DEFAULT 2000000 CHECK(monthly_limit_microeur BETWEEN 0 AND 23000000);
INSERT INTO artessencia_intelligence_private.ai_budget_control(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.ai_budget_entries(
 request_id uuid PRIMARY KEY,
 channel text NOT NULL CHECK(channel IN ('director','financeiro','producao','stock','marketing','comercial','inovacao','auditoria','catalogo','legacy_insights','legacy_description','legacy_social')),
 model text NOT NULL CHECK(length(model) BETWEEN 1 AND 100),
 maximum_microeur bigint NOT NULL CHECK(maximum_microeur BETWEEN 1 AND 23000000),
 reserved_at timestamptz NOT NULL,
 reserved_month date NOT NULL,
 status text NOT NULL CHECK(status IN ('reserved','inflight','unknown','settled','void')),
 actual_microeur bigint CHECK(actual_microeur>=0),
 settled_month date,
 evidence_ref text,
 CHECK((status IN ('settled','void'))=(actual_microeur IS NOT NULL AND settled_month IS NOT NULL AND evidence_ref IS NOT NULL)),
 CHECK(status<>'void' OR actual_microeur=0)
);
ALTER TABLE artessencia_intelligence_private.ai_budget_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.ai_budget_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.ai_budget_control,artessencia_intelligence_private.ai_budget_entries FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_reserve(p_id uuid,p_channel text,p_model text,p_max bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $reserve$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; m date; used numeric; stamp timestamptz;
BEGIN
 IF p_id IS NULL OR p_channel IS NULL OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 23000000 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR NOT c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 stamp:=clock_timestamp();m:=date_trunc('month',stamp AT TIME ZONE 'Europe/Lisbon')::date;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id) THEN RAISE EXCEPTION 'DUPLICATE_REQUEST'; END IF;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used+p_max>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 INSERT INTO artessencia_intelligence_private.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status)
 VALUES(p_id,p_channel,p_model,p_max,stamp,m,'reserved');
 RETURN jsonb_build_object('requestId',p_id,'maximumMicroeur',p_max,'remainingMicroeur',c.monthly_limit_microeur-used-p_max,'status','reserved');
END;
$reserve$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_claim(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; used numeric;
BEGIN
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR NOT c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 -- Recheck under the same shared lock: lowering the cap after reservation must prevent new provider calls.
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status='inflight' WHERE request_id=p_id AND status='reserved' RETURNING * INTO e;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_CLAIMABLE'; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status','inflight','model',e.model,'maximumMicroeur',e.maximum_microeur);
END;
$claim$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_unknown(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $unknown$
BEGIN
 PERFORM 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_UNAVAILABLE'; END IF;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status='unknown' WHERE request_id=p_id AND status='inflight';
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_INFLIGHT'; END IF;
END;
$unknown$;

-- Only a trusted server worker may reconcile, using independently verified provider evidence.
-- The evidence reference alone is not proof: gateway integration must enforce verification.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_settle(p_id uuid,p_actual bigint,p_evidence text,p_no_charge boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $settle$
DECLARE e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; new_status text;
BEGIN
 IF p_actual IS NULL OR p_actual<0 OR p_evidence IS NULL OR length(trim(p_evidence)) NOT BETWEEN 1 AND 200 OR p_no_charge IS NULL OR (p_no_charge AND p_actual<>0) THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_UNAVAILABLE'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT (e.status IN ('inflight','unknown') OR (e.status='reserved' AND p_no_charge)) THEN RAISE EXCEPTION 'REQUEST_NOT_SETTLEABLE'; END IF;
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 new_status:=CASE WHEN p_no_charge THEN 'void' ELSE 'settled' END;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status=new_status,actual_microeur=p_actual,settled_month=m,evidence_ref=p_evidence WHERE request_id=p_id;
 IF p_actual>e.maximum_microeur THEN UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=true,release_enabled=false WHERE singleton=true; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status',new_status,'actualMicroeur',p_actual,'overrun',p_actual>e.maximum_microeur);
END;
$settle$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.ai_budget_reserve(uuid,text,text,bigint),artessencia_intelligence_private.ai_budget_claim(uuid),artessencia_intelligence_private.ai_budget_unknown(uuid),artessencia_intelligence_private.ai_budget_settle(uuid,bigint,text,boolean) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-team-draft-v1.sql
-- LAB ONLY: no migration or application grants. Trusted server commands, not public RPC.
CREATE SCHEMA IF NOT EXISTS artessencia_intelligence_private;
REVOKE ALL ON SCHEMA artessencia_intelligence_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_controls(
 user_id uuid PRIMARY KEY, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 enabled boolean NOT NULL DEFAULT false,
 modes jsonb NOT NULL DEFAULT '{"director":"off","stock":"off","producao":"off","financeiro":"off","comercial":"off","marketing":"off","inovacao":"off","catalogo":"off","auditoria":"off"}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_missions(
 user_id uuid NOT NULL, mission_id uuid NOT NULL, agent text NOT NULL,
 kind text NOT NULL, instruction text NOT NULL CHECK(length(trim(instruction)) BETWEEN 1 AND 4000),
 revision bigint NOT NULL DEFAULT 0, control_revision bigint NOT NULL,
 status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','working','review_ready','blocked','cancelled')),
 result_summary text CHECK(length(result_summary)<=1600),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,mission_id)
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_events(
 user_id uuid NOT NULL, mission_id uuid NOT NULL, revision bigint NOT NULL,
 status text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,mission_id,revision),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_memory(
 user_id uuid NOT NULL, memory_id uuid NOT NULL, agent text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('objective','decision','rule','lesson','mission_summary')),
 summary text NOT NULL CHECK(length(trim(summary)) BETWEEN 1 AND 1000),
 evidence_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(user_id,memory_id), CHECK(expires_at>created_at AND expires_at<=created_at+interval '365 days')
);
ALTER TABLE artessencia_intelligence_private.team_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.team_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.team_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.team_memory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.team_controls,artessencia_intelligence_private.team_missions,artessencia_intelligence_private.team_events,artessencia_intelligence_private.team_memory FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_set_controls(p_revision bigint,p_enabled boolean,p_modes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $controls$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype; a text;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_enabled IS NULL OR jsonb_typeof(p_modes) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_CONTROLS'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_modes))<>9 THEN RAISE EXCEPTION 'INVALID_CONTROLS'; END IF;
 FOREACH a IN ARRAY ARRAY['director','stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'] LOOP
  IF coalesce(p_modes->>a,'') NOT IN ('off','manual','semi','auto') OR (NOT p_enabled AND p_modes->>a<>'off') THEN RAISE EXCEPTION 'INVALID_CONTROLS'; END IF;
 END LOOP;
 INSERT INTO artessencia_intelligence_private.team_controls(user_id) VALUES(actor) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF c.revision<>p_revision THEN RAISE EXCEPTION 'TEAM_REVISION_CONFLICT'; END IF;
 UPDATE artessencia_intelligence_private.team_controls SET enabled=p_enabled,modes=p_modes,revision=c.revision+1,updated_at=clock_timestamp() WHERE user_id=actor RETURNING * INTO c;
 RETURN to_jsonb(c);
END;
$controls$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_create_mission(p_id uuid,p_agent text,p_kind text,p_instruction text,p_control_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $create$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype; m artessencia_intelligence_private.team_missions%rowtype; allowed boolean;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 allowed:=CASE p_agent
 WHEN 'director' THEN p_kind='daily_priority_plan'
 WHEN 'stock' THEN p_kind IN ('inventory_audit','inventory_count_plan','stock_organization_plan','stock_rename_plan','stock_merge_batch_plan')
 WHEN 'producao' THEN p_kind IN ('production_plan','inventory_audit')
 WHEN 'financeiro' THEN p_kind='finance_review'
 WHEN 'comercial' THEN p_kind='commercial_review'
 WHEN 'marketing' THEN p_kind='marketing_plan'
 WHEN 'inovacao' THEN p_kind='innovation_review'
 WHEN 'catalogo' THEN p_kind='catalog_review'
 WHEN 'auditoria' THEN p_kind IN ('technical_review','inventory_audit') ELSE false END;
 IF allowed IS DISTINCT FROM true OR p_id IS NULL OR p_instruction IS NULL OR length(trim(p_instruction)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'INVALID_MISSION'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled OR coalesce(c.modes->>p_agent,'off')='off' OR c.revision IS DISTINCT FROM p_control_revision THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 INSERT INTO artessencia_intelligence_private.team_missions(user_id,mission_id,agent,kind,instruction,control_revision)
 VALUES(actor,p_id,p_agent,p_kind,p_instruction,c.revision) ON CONFLICT DO NOTHING RETURNING * INTO m;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_ID_USED'; END IF;
 INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,0,'pending_review');
 RETURN to_jsonb(m);
END;
$create$;

-- Only trusted server worker may invoke. Human approval and agent identity must
-- be checked by distinct authenticated commands before this internal transition.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_transition(p_id uuid,p_revision bigint,p_next text,p_summary text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $transition$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype; m artessencia_intelligence_private.team_missions%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR m.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'MISSION_REVISION_CONFLICT'; END IF;
 IF p_next IS NULL OR NOT ((m.status='pending_review' AND p_next IN ('approved','cancelled')) OR (m.status='approved' AND p_next IN ('working','cancelled')) OR (m.status='working' AND p_next IN ('review_ready','blocked','cancelled'))) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 IF p_next<>'cancelled' AND (NOT c.enabled OR coalesce(c.modes->>m.agent,'off')='off' OR c.revision<>m.control_revision) THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 IF p_next IN ('review_ready','blocked') THEN
  IF p_summary IS NULL OR length(trim(p_summary)) NOT BETWEEN 1 AND 1600 THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 ELSIF p_summary IS NOT NULL THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 UPDATE artessencia_intelligence_private.team_missions SET status=p_next,revision=m.revision+1,result_summary=p_summary,updated_at=clock_timestamp() WHERE user_id=actor AND mission_id=p_id RETURNING * INTO m;
 INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,m.revision,p_next);
 RETURN to_jsonb(m);
END;
$transition$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_set_controls(bigint,boolean,jsonb),artessencia_intelligence_private.team_create_mission(uuid,text,text,text,bigint),artessencia_intelligence_private.team_transition(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-run-draft-v1.sql
-- Laboratory only. Apply after intelligence-team and intelligence-ai-budget drafts.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_runs(
 user_id uuid NOT NULL, mission_id uuid NOT NULL, lease_id uuid NOT NULL UNIQUE,
 request_id uuid NOT NULL UNIQUE, claimed_revision bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('working','review_ready','blocked')),
 outcome jsonb, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), ended_at timestamptz,
 PRIMARY KEY(user_id,mission_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id),
 CHECK((status='working' AND outcome IS NULL AND ended_at IS NULL) OR (status<>'working' AND outcome IS NOT NULL AND ended_at IS NOT NULL))
);
ALTER TABLE artessencia_intelligence_private.team_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.team_runs FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_claim_run(p_id uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE actor uuid:=auth.uid(); m jsonb; r artessencia_intelligence_private.team_runs%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 m:=artessencia_intelligence_private.team_transition(p_id,p_revision,'working',NULL);
 INSERT INTO artessencia_intelligence_private.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status)
 VALUES(actor,p_id,gen_random_uuid(),gen_random_uuid(),(m->>'revision')::bigint,'working') RETURNING * INTO r;
 RETURN m||jsonb_build_object('lease_id',r.lease_id,'request_id',r.request_id);
END;
$claim$;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_run_status(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $status$
DECLARE actor uuid:=auth.uid(); result jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT jsonb_build_object('missionId',m.mission_id,'owner',m.user_id,'agent',m.agent,'kind',m.kind,
 'missionStatus',m.status,'missionRevision',m.revision,'controlRevision',m.control_revision,
 'leaseId',r.lease_id,'requestId',r.request_id,'runStatus',r.status,'outcome',r.outcome,
 'active',coalesce(c.enabled AND c.revision=m.control_revision AND c.modes->>m.agent<>'off'
 AND m.status='working' AND r.status='working' AND r.claimed_revision=m.revision,false),
 'memory',CASE WHEN c.enabled AND c.revision=m.control_revision AND c.modes->>m.agent<>'off' AND m.status='working' AND r.status='working'
 THEN (SELECT coalesce(jsonb_agg(to_jsonb(k)),'[]') FROM (SELECT kind,summary,evidence_id FROM artessencia_intelligence_private.team_memory mem WHERE mem.user_id=actor AND mem.agent=m.agent AND mem.revoked_at IS NULL AND mem.expires_at>clock_timestamp() ORDER BY mem.created_at DESC,mem.memory_id LIMIT 6)k) ELSE '[]'::jsonb END,
 'settings',jsonb_build_object('enabled',coalesce(c.enabled,false),'agents',c.modes,'paidEnabled',false,'monthlyCeilingCents',3000))
 INTO result FROM artessencia_intelligence_private.team_missions m
 LEFT JOIN artessencia_intelligence_private.team_runs r ON r.user_id=m.user_id AND r.mission_id=m.mission_id
 LEFT JOIN artessencia_intelligence_private.team_controls c ON c.user_id=m.user_id
 WHERE m.user_id=actor AND m.mission_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_NOT_FOUND'; END IF;
 RETURN result;
END;
$status$;
-- Worker receipts are reported, not yet independently verified tool write proofs.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_finish_run(p_id uuid,p_lease uuid,p_status text,p_outcome jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype;
 m artessencia_intelligence_private.team_missions%rowtype; r artessencia_intelligence_private.team_runs%rowtype;
 e artessencia_intelligence_private.ai_budget_entries%rowtype; charge bigint; summary text;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('review_ready','blocked') OR jsonb_typeof(p_outcome) IS DISTINCT FROM 'object'
 OR octet_length(p_outcome::text)>100000 OR jsonb_typeof(p_outcome->'receipts') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 IF jsonb_array_length(p_outcome->'receipts')>8 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_NOT_FOUND'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.lease_id IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
 IF r.status<>'working' THEN
  IF r.status=p_status AND r.outcome=p_outcome THEN RETURN jsonb_build_object('missionId',p_id,'leaseId',p_lease,'status',r.status,'replayed',true); END IF;
  RAISE EXCEPTION 'RUN_ALREADY_FINAL';
 END IF;
 IF p_status='review_ready' THEN
  IF NOT c.enabled OR c.revision<>m.control_revision OR coalesce(c.modes->>m.agent,'off')='off'
   OR m.status<>'working' OR m.revision<>r.claimed_revision THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
  IF jsonb_typeof(p_outcome->'chargedMicroeur') IS DISTINCT FROM 'number' OR coalesce(p_outcome->>'chargedMicroeur','') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'CHARGE_UNVERIFIED'; END IF;
  charge:=(p_outcome->>'chargedMicroeur')::bigint;
  SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=r.request_id;
  IF NOT FOUND OR e.status<>'settled' OR e.channel<>m.agent OR e.actual_microeur IS DISTINCT FROM charge THEN RAISE EXCEPTION 'CHARGE_UNVERIFIED'; END IF;
  summary:=p_outcome->>'summary';
  IF summary IS NULL OR length(trim(summary)) NOT BETWEEN 1 AND 1600 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
  PERFORM artessencia_intelligence_private.team_transition(p_id,m.revision,'review_ready',summary);
 ELSE
  IF m.status='working' AND m.revision=r.claimed_revision THEN
   UPDATE artessencia_intelligence_private.team_missions SET status='blocked',revision=m.revision+1,result_summary='Execução interrompida; verificar recibos e orçamento.',updated_at=clock_timestamp()
    WHERE user_id=actor AND mission_id=p_id;
   INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,m.revision+1,'blocked');
  ELSIF m.status<>'cancelled' THEN RAISE EXCEPTION 'MISSION_REVISION_CONFLICT'; END IF;
 END IF;
 UPDATE artessencia_intelligence_private.team_runs SET status=p_status,outcome=p_outcome,ended_at=clock_timestamp() WHERE user_id=actor AND mission_id=p_id;
 RETURN jsonb_build_object('missionId',p_id,'leaseId',p_lease,'status',p_status,'replayed',false);
END;
$finish$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_claim_run(uuid,bigint),artessencia_intelligence_private.team_run_status(uuid),artessencia_intelligence_private.team_finish_run(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-stock-context-draft-v1.sql
-- Laboratory only: read-only, least-data projection bound to active mission.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_stock_context(p_id uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $context$
DECLARE actor uuid:=auth.uid(); m artessencia_intelligence_private.team_missions%rowtype;
 c artessencia_intelligence_private.team_controls%rowtype; r artessencia_intelligence_private.team_runs%rowtype;
 s public.artessencia_v1_state%rowtype; payload jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR m.status<>'working' OR m.control_revision<>c.revision OR coalesce(c.modes->>m.agent,'off')='off'
 OR NOT ((m.agent IN ('stock','producao','auditoria') AND m.kind='inventory_audit') OR (m.agent='stock' AND m.kind='stock_organization_plan'))
 THEN RAISE EXCEPTION 'CONTEXT_SCOPE_DENIED'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'working' OR r.lease_id IS DISTINCT FROM p_lease OR r.claimed_revision<>m.revision THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
 SELECT * INTO s FROM public.artessencia_v1_state WHERE user_id=actor;
 IF NOT FOUND OR s.revision IS NULL OR s.revision<0 OR jsonb_typeof(s.data->'stock') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'SOURCE_UNAVAILABLE'; END IF;
 IF jsonb_array_length(s.data->'stock')>5000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s.data->'stock') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
 SELECT jsonb_build_object('stock',coalesce(jsonb_agg(jsonb_build_object('name',x->'name','unit',x->'unit','qty',x->'qty','unitCost',x->'unitCost','category',x->'category') ORDER BY ord),'[]'::jsonb))
 INTO payload FROM jsonb_array_elements(s.data->'stock') WITH ORDINALITY AS a(x,ord);
 IF m.kind='inventory_audit' THEN
  IF jsonb_typeof(s.data->'productRecipes') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SOURCE_UNAVAILABLE'; END IF;
  IF (SELECT count(*) FROM public.artessencia_v1_products WHERE user_id=actor)>5000 OR (SELECT count(*) FROM jsonb_object_keys(s.data->'productRecipes'))>5000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
  IF EXISTS(SELECT 1 FROM public.artessencia_v1_products p WHERE p.user_id=actor AND jsonb_typeof(p.data->'code') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
  payload:=payload||jsonb_build_object('products',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',p.data->'code') ORDER BY p.id),'[]'::jsonb) FROM public.artessencia_v1_products p WHERE p.user_id=actor),
   'productRecipes',(SELECT coalesce(jsonb_object_agg(k,CASE WHEN jsonb_typeof(v)='array' THEN
   (SELECT coalesce(jsonb_agg(jsonb_build_object('item',x->'item','qty',x->'qty','unit',x->'unit') ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(v) WITH ORDINALITY AS a(x,ord)) ELSE 'null'::jsonb END),'{}'::jsonb)
   FROM jsonb_each(s.data->'productRecipes') AS a(k,v)));
 END IF;
 IF octet_length(payload::text)>1000000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('verified',true,'owner',actor,'missionId',p_id,'leaseId',p_lease,'agent',m.agent,'kind',m.kind,'sourceRevision',s.revision,'evidenceIds',jsonb_build_array('canonical-state-r'||s.revision::text),'payload',payload);
END;
$context$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_stock_context(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-owner-console-v1.sql
-- Instalar apenas após validação das dependências team, run e ai-budget.

ALTER TABLE artessencia_intelligence_private.team_runs ADD COLUMN IF NOT EXISTS tool_receipts jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_inputs(
 user_id uuid NOT NULL,mission_id uuid NOT NULL,mime text NOT NULL,content text,expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id),FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.team_inputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.team_inputs FROM PUBLIC,anon,authenticated;
-- Explicitly reviewed material creation; no balance inferred from an attachment.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.material_creation_receipts(
 user_id uuid NOT NULL,mission_id uuid NOT NULL,line_index integer NOT NULL CHECK(line_index BETWEEN 0 AND 99),
 material jsonb NOT NULL,source_revision bigint NOT NULL,committed_revision bigint NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id,line_index),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.material_creation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.material_creation_receipts FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.recipe_reference_receipts(
 user_id uuid NOT NULL,mission_id uuid NOT NULL,proposal_index integer NOT NULL CHECK(proposal_index BETWEEN 0 AND 49),
 proposal jsonb NOT NULL,source_revision bigint NOT NULL,committed_revision bigint NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id,proposal_index),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.recipe_reference_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.recipe_reference_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.material_name_key(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $key$
 SELECT lower(regexp_replace(trim(regexp_replace(normalize(p_name,NFD),'[̀-ͯ]','','g')),'[[:space:]]+',' ','g'));
$key$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.material_name_key(text) FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_delegations(
 user_id uuid NOT NULL, parent_id uuid NOT NULL, child_id uuid NOT NULL, department text NOT NULL,
 PRIMARY KEY(user_id,child_id), UNIQUE(user_id,parent_id,department), CHECK(parent_id<>child_id),
 FOREIGN KEY(user_id,parent_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id),
 FOREIGN KEY(user_id,child_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_routines(
 user_id uuid NOT NULL REFERENCES artessencia_intelligence_private.team_controls(user_id), agent text NOT NULL,
 cadence text NOT NULL CHECK(cadence IN ('daily','weekly','monthly')), kind text NOT NULL, instruction text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, last_period date, PRIMARY KEY(user_id,agent,cadence)
);
ALTER TABLE artessencia_intelligence_private.team_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.team_routines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.team_delegations,artessencia_intelligence_private.team_routines FROM PUBLIC,anon,authenticated;

-- Each invocation prepares at most one mission per enabled routine for its Lisbon calendar period.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_tick()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $tick$
DECLARE
 rule record;
 business_day date := (statement_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 period_start date;
 mission uuid;
 prepared integer := 0;
BEGIN
 FOR rule IN SELECT r.*,c.revision,c.modes->>r.agent AS execution_mode FROM artessencia_intelligence_private.team_controls c
  JOIN artessencia_intelligence_private.team_routines r USING(user_id)
  WHERE c.user_id=auth.uid() AND c.enabled AND r.enabled AND c.modes->>r.agent IN ('semi','auto')
  ORDER BY c.user_id,r.agent,r.cadence FOR UPDATE OF c,r SKIP LOCKED LOOP
  period_start:=CASE rule.cadence WHEN 'daily' THEN business_day WHEN 'weekly' THEN date_trunc('week',business_day)::date ELSE date_trunc('month',business_day)::date END;
  IF rule.last_period>=period_start THEN CONTINUE; END IF;
  mission:=gen_random_uuid();
  INSERT INTO artessencia_intelligence_private.team_missions(user_id,mission_id,agent,kind,instruction,control_revision)
  VALUES(rule.user_id,mission,rule.agent,rule.kind,rule.instruction,rule.revision);
  INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(rule.user_id,mission,0,'pending_review');
  IF rule.execution_mode='auto' THEN
   UPDATE artessencia_intelligence_private.team_missions SET status='approved',revision=1 WHERE user_id=rule.user_id AND mission_id=mission;
   INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(rule.user_id,mission,1,'approved');
  END IF;
  UPDATE artessencia_intelligence_private.team_routines SET last_period=period_start WHERE user_id=rule.user_id AND agent=rule.agent AND cadence=rule.cadence;
  prepared:=prepared+1;
 END LOOP;
 RETURN prepared;
END;
$tick$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_tick() FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.stock_change_release(
 user_id uuid PRIMARY KEY,enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.stock_change_receipts(
 user_id uuid NOT NULL,operation_id uuid NOT NULL,mission_id uuid NOT NULL,request jsonb NOT NULL,preview jsonb NOT NULL,
 before_state jsonb NOT NULL,after_state jsonb NOT NULL,relation_digest text NOT NULL,
 committed_revision bigint NOT NULL,created_at timestamptz NOT NULL,reverted_revision bigint,
 PRIMARY KEY(user_id,operation_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.stock_change_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.stock_change_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.stock_change_release,artessencia_intelligence_private.stock_change_receipts FROM PUBLIC,anon,authenticated;
-- Read-only preflight. Never return full state, orders or customer information.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.stock_change_preview(p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $stockpreview$
DECLARE
 actor uuid:=auth.uid(); mission uuid:=(p_args->>'mission')::uuid;
 op text:=p_args->>'operation'; old_name text:=p_args->>'source'; new_name text:=p_args->>'target';
 old_key text; new_key text; st public.artessencia_v1_state%rowtype;
 src jsonb; dst jsonb; hits bigint; dest_hits bigint; recipe_lines bigint:=0; products_affected bigint:=0;
 related_products bigint:=0; related_orders bigint:=0; related_quotes bigint:=0; related_cloud bigint:=0;
 legacy_state boolean:=false; duplicate_recipe boolean:=false; blockers text[]:=ARRAY[]::text[];
 old_qty numeric; dest_qty numeric; cost numeric; dest_cost numeric; proposed_qty numeric;
 result jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF op IS NULL OR op NOT IN ('rename','merge') OR old_name IS NULL OR new_name IS NULL OR old_name=new_name
 OR length(old_name) NOT BETWEEN 1 AND 200 OR length(new_name) NOT BETWEEN 1 AND 200
 OR trim(old_name)<>old_name OR trim(new_name)<>new_name OR old_name ~ '[[:cntrl:]<>"]' OR new_name ~ '[[:cntrl:]<>"]'
 OR position(chr(92) in old_name)>0 OR position(chr(92) in new_name)>0 OR old_name ~ '&[[:alnum:]#]+;' OR new_name ~ '&[[:alnum:]#]+;'
 OR old_name IN ('__proto__','constructor','prototype') OR new_name IN ('__proto__','constructor','prototype') THEN RAISE EXCEPTION 'INVALID_STOCK_PREVIEW'; END IF;
 old_key:=artessencia_intelligence_private.material_name_key(old_name); new_key:=artessencia_intelligence_private.material_name_key(new_name);
 IF old_key='' OR new_key='' THEN RAISE EXCEPTION 'INVALID_STOCK_PREVIEW'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.team_controls c JOIN artessencia_intelligence_private.team_missions m USING(user_id)
 WHERE c.user_id=actor AND c.enabled AND c.modes->>'stock'<>'off' AND c.revision=m.control_revision
 AND m.mission_id=mission AND m.agent='stock' AND m.kind IN ('inventory_audit','stock_organization_plan') AND m.status='review_ready';
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_PREVIEW_NOT_AUTHORIZED'; END IF;
 SELECT * INTO st FROM public.artessencia_v1_state WHERE user_id=actor;
 IF NOT FOUND OR jsonb_typeof(st.data->'stock') IS DISTINCT FROM 'array' OR jsonb_typeof(st.data->'productRecipes') IS DISTINCT FROM 'object'
 OR jsonb_array_length(st.data->'stock')>5000 OR octet_length(st.data::text)>10000000 THEN RAISE EXCEPTION 'SOURCE_UNAVAILABLE'; END IF;
 SELECT count(*),jsonb_agg(x)->0 INTO hits,src FROM jsonb_array_elements(st.data->'stock') x WHERE x->>'name'=old_name;
 SELECT count(*),jsonb_agg(x)->0 INTO dest_hits,dst FROM jsonb_array_elements(st.data->'stock') x WHERE x->>'name'=new_name;
 IF hits<>1 THEN blockers:=array_append(blockers,'origem_ambigua_ou_ausente'); END IF;
 IF (op='merge' AND dest_hits<>1) OR (op='rename' AND dest_hits<>0) THEN blockers:=array_append(blockers,'destino_ambiguo_ou_incompativel'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(st.data->'stock') x
 WHERE x->>'name' NOT IN (old_name,new_name) AND artessencia_intelligence_private.material_name_key(x->>'name') IN (old_key,new_key)) THEN
 blockers:=array_append(blockers,'outro_material_semelhante'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'array') THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
 SELECT count(*),count(DISTINCT e.key) INTO recipe_lines,products_affected
 FROM jsonb_each(st.data->'productRecipes') e CROSS JOIN LATERAL jsonb_array_elements(e.value) r WHERE r->>'item'=old_name;
 SELECT EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e WHERE
 (SELECT count(*) FROM jsonb_array_elements(e.value) r WHERE artessencia_intelligence_private.material_name_key(r->>'item') IN(old_key,new_key))>1)
 INTO duplicate_recipe;
 IF duplicate_recipe THEN blockers:=array_append(blockers,'varias_referencias_na_mesma_ficha'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e CROSS JOIN LATERAL jsonb_array_elements(e.value) r
 WHERE artessencia_intelligence_private.material_name_key(r->>'item') IN(old_key,new_key)
 AND r->>'item' NOT IN(old_name,new_name)) THEN blockers:=array_append(blockers,'referencias_com_outros_nomes'); END IF;
 IF op='rename' AND EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e CROSS JOIN LATERAL jsonb_array_elements(e.value) r WHERE r->>'item'=new_name) THEN
 blockers:=array_append(blockers,'destino_ja_referenciado'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e CROSS JOIN LATERAL jsonb_array_elements(e.value) r
 WHERE r->>'item' IN(old_name,new_name) AND (coalesce(r->>'unit','') NOT IN ('',coalesce(src->>'unit','')) OR CASE WHEN coalesce(r->>'qty','') ~ '^[0-9]+([.][0-9]+)?$' THEN (r->>'qty')::numeric<=0 ELSE true END)) THEN
 blockers:=array_append(blockers,'quantidade_ou_unidade_da_ficha_invalida'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(st.data->'productRecipes') e CROSS JOIN LATERAL jsonb_array_elements(e.value) r
 WHERE position(old_key in artessencia_intelligence_private.material_name_key((r-'item')::text))>0 OR position(new_key in artessencia_intelligence_private.material_name_key((r-'item')::text))>0) THEN
 blockers:=array_append(blockers,'metadados_de_ficha_exigem_reconciliacao'); END IF;
 -- Conservative search of the remaining state. Includes purchase, movement, cost, production and unknown legacy fields.
 legacy_state:=position(old_key in artessencia_intelligence_private.material_name_key((st.data-'stock'-'productRecipes')::text))>0
 OR position(new_key in artessencia_intelligence_private.material_name_key((st.data-'stock'-'productRecipes')::text))>0;
 IF legacy_state THEN blockers:=array_append(blockers,'historico_ou_outros_registos_exigem_reconciliacao'); END IF;
 SELECT count(*) INTO related_products FROM public.artessencia_v1_products p WHERE p.user_id=actor AND
 (position(old_key in artessencia_intelligence_private.material_name_key(p.data::text))>0 OR
 position(new_key in artessencia_intelligence_private.material_name_key(p.data::text))>0);
 SELECT count(*) INTO related_orders FROM public.artessencia_v1_orders p WHERE p.user_id=actor AND
 (position(old_key in artessencia_intelligence_private.material_name_key(p.data::text))>0 OR
 position(new_key in artessencia_intelligence_private.material_name_key(p.data::text))>0);
 SELECT count(*) INTO related_quotes FROM public.artessencia_v1_quotes p WHERE p.user_id=actor AND
 (position(old_key in artessencia_intelligence_private.material_name_key(p.data::text))>0 OR
 position(new_key in artessencia_intelligence_private.material_name_key(p.data::text))>0);
 SELECT count(*) INTO related_cloud FROM public.artessencia_cloud_records p WHERE p.user_id=actor AND
 (position(old_key in artessencia_intelligence_private.material_name_key(p.data::text))>0 OR position(new_key in artessencia_intelligence_private.material_name_key(p.data::text))>0);
 IF related_products+related_orders+related_quotes+related_cloud>0 THEN blockers:=array_append(blockers,'referencias_relacionais_exigem_reconciliacao'); END IF;
 IF src IS NOT NULL AND coalesce(src->>'qty','') ~ '^[0-9]+([.][0-9]+)?$' AND coalesce(src->>'unitCost','') ~ '^[0-9]+([.][0-9]+)?$'
 AND coalesce(src->>'unit','') IN ('g','ml','cm','un') THEN old_qty:=(src->>'qty')::numeric; cost:=(src->>'unitCost')::numeric;
 ELSE blockers:=array_append(blockers,'saldo_custo_ou_unidade_invalidos'); END IF;
 IF cost IS NOT NULL AND (cost<=0 OR old_qty>1000000000000 OR (src->>'unit'='un' AND trunc(old_qty)<>old_qty)) THEN blockers:=array_append(blockers,'saldo_ou_custo_por_validar'); END IF;
 IF op='merge' THEN
  IF dst IS NOT NULL AND coalesce(dst->>'qty','') ~ '^[0-9]+([.][0-9]+)?$' AND coalesce(dst->>'unitCost','') ~ '^[0-9]+([.][0-9]+)?$'
  THEN dest_qty:=(dst->>'qty')::numeric; dest_cost:=(dst->>'unitCost')::numeric; END IF;
  IF dest_qty IS NULL OR dest_cost IS NULL OR cost IS NULL OR dest_cost<>cost OR src->>'unit' IS DISTINCT FROM dst->>'unit'
  OR dest_qty>1000000000000 OR (dst->>'unit'='un' AND trunc(dest_qty)<>dest_qty) THEN blockers:=array_append(blockers,'unidades_custos_ou_saldos_incompativeis'); END IF;
  IF src ? 'id' OR dst ? 'id' OR (src-'name'-'qty'-'unitCost') IS DISTINCT FROM (dst-'name'-'qty'-'unitCost') THEN blockers:=array_append(blockers,'identificadores_ou_metadados_distintos'); END IF;
  IF p_args->'identityConfirmed' IS DISTINCT FROM 'true'::jsonb THEN blockers:=array_append(blockers,'identidade_nao_confirmada'); END IF;
  IF p_args->>'balanceMode' IS DISTINCT FROM 'distinct_physical_balances' THEN blockers:=array_append(blockers,'origem_dos_saldos_nao_confirmada'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(coalesce(src,'{}')) k WHERE k NOT IN ('name','qty','unit','unitCost','min','target','preferredSupplier','imageUrl','category'))
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(coalesce(dst,'{}')) k WHERE k NOT IN ('name','qty','unit','unitCost','min','target','preferredSupplier','imageUrl','category')) THEN
   blockers:=array_append(blockers,'metadados_nao_reconciliados'); END IF;
  proposed_qty:=old_qty+dest_qty;
  IF proposed_qty>1000000000000 THEN blockers:=array_append(blockers,'saldo_total_invalido'); END IF;
 ELSE proposed_qty:=old_qty; END IF;
 RETURN jsonb_build_object('mode','simulation_only','status',CASE WHEN cardinality(blockers)=0 THEN 'review' ELSE 'blocked' END,
 'operation',op,'source',old_name,'target',new_name,'sourceRevision',st.revision,'sourceQty',old_qty,'targetQty',dest_qty,
 'unit',src->>'unit','unitCost',cost,'proposedQty',CASE WHEN cardinality(blockers)=0 THEN proposed_qty ELSE NULL END,
 'inventoryValue',CASE WHEN cardinality(blockers)=0 THEN proposed_qty*cost ELSE NULL END,
 'recipeLines',recipe_lines,'productsAffected',products_affected,'historicalOrOtherReferences',legacy_state,
 'relatedProductRecords',related_products,'relatedOrderRecords',related_orders,'relatedQuoteRecords',related_quotes,'relatedCloudRecords',related_cloud,
 'executionEnabled',EXISTS(SELECT 1 FROM artessencia_intelligence_private.stock_change_release g WHERE g.user_id=actor AND g.enabled),
 'blockers',to_jsonb(blockers));
END;
$stockpreview$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.stock_change_preview(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.stock_relation_digest(p_user uuid)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $digest$
 SELECT encode(sha256(convert_to(jsonb_build_array(
 (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.artessencia_v1_products p WHERE p.user_id=p_user),
 (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.artessencia_v1_orders p WHERE p.user_id=p_user),
 (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.artessencia_v1_quotes p WHERE p.user_id=p_user),
 (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.entity,p.record_id),'[]') FROM public.artessencia_cloud_records p WHERE p.user_id=p_user)
 )::text,'UTF8')),'hex');
$digest$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.stock_relation_digest(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.stock_change_commit(p_action text,p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $stockcommit$
DECLARE
 actor uuid:=auth.uid(); op_id uuid:=(p_args->>'operationId')::uuid; req jsonb:=p_args->'request';
 mid uuid; prior artessencia_intelligence_private.stock_change_receipts%rowtype;
 st public.artessencia_v1_state%rowtype; plan jsonb; previous_data jsonb; next_data jsonb;
 new_stock jsonb; new_recipes jsonb; old_name text; new_name text; stamp timestamptz:=clock_timestamp();
 current_digest text; gate boolean;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF op_id IS NULL OR p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR p_action NOT IN('apply','revert') THEN RAISE EXCEPTION 'STOCK_CONFIRMATION_REQUIRED'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.team_controls c WHERE c.user_id=actor AND c.enabled AND c.modes->>'stock'<>'off' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_NOT_AUTHORIZED'; END IF;
 SELECT enabled INTO gate FROM artessencia_intelligence_private.stock_change_release WHERE user_id=actor FOR UPDATE;
 IF gate IS DISTINCT FROM true THEN RAISE EXCEPTION 'STOCK_EXECUTION_DISABLED'; END IF;
 SELECT * INTO prior FROM artessencia_intelligence_private.stock_change_receipts z WHERE z.user_id=actor AND z.operation_id=op_id FOR UPDATE;
 IF FOUND THEN
  IF p_action='apply' THEN
   IF req IS DISTINCT FROM prior.request OR p_args->'preview' IS DISTINCT FROM prior.preview THEN RAISE EXCEPTION 'STOCK_RECEIPT_CONFLICT'; END IF;
   RETURN jsonb_build_object('status',CASE WHEN prior.reverted_revision IS NULL THEN 'confirmed' ELSE 'reverted' END,'revision',coalesce(prior.reverted_revision,prior.committed_revision),'replayed',true);
  END IF;
  IF prior.reverted_revision IS NOT NULL THEN RETURN jsonb_build_object('status','reverted','revision',prior.reverted_revision,'replayed',true); END IF;
 ELSIF p_action='revert' THEN RAISE EXCEPTION 'STOCK_RECEIPT_NOT_FOUND'; END IF;
 mid:=CASE WHEN p_action='revert' THEN prior.mission_id ELSE (req->>'mission')::uuid END;
 PERFORM 1 FROM artessencia_intelligence_private.team_missions m JOIN artessencia_intelligence_private.team_controls c USING(user_id)
 WHERE m.user_id=actor AND m.mission_id=mid AND m.agent='stock' AND m.status='review_ready' AND c.revision=m.control_revision FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_NOT_AUTHORIZED'; END IF;
 SELECT * INTO st FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 LOCK TABLE public.artessencia_v1_products,public.artessencia_v1_orders,public.artessencia_v1_quotes,public.artessencia_cloud_records IN SHARE MODE NOWAIT;
 current_digest:=artessencia_intelligence_private.stock_relation_digest(actor);
 previous_data:=jsonb_build_object('stock',st.data->'stock','productRecipes',st.data->'productRecipes');
 IF p_action='revert' THEN
  IF st.revision IS DISTINCT FROM prior.committed_revision OR previous_data IS DISTINCT FROM prior.after_state OR current_digest IS DISTINCT FROM prior.relation_digest THEN RAISE EXCEPTION 'STOCK_REVERSAL_STALE'; END IF;
  UPDATE public.artessencia_v1_state SET data=st.data||prior.before_state,revision=st.revision+1,updated_at=stamp,device_id='intelligence-server' WHERE user_id=actor RETURNING * INTO st;
  UPDATE artessencia_intelligence_private.stock_change_receipts z SET reverted_revision=st.revision WHERE z.user_id=actor AND z.operation_id=op_id;
  RETURN jsonb_build_object('status','reverted','revision',st.revision,'replayed',false);
 END IF;
 plan:=artessencia_intelligence_private.stock_change_preview(req);
 IF plan->>'status' IS DISTINCT FROM 'review' OR plan IS DISTINCT FROM p_args->'preview' OR plan->'executionEnabled' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'STOCK_PREVIEW_STALE_OR_BLOCKED'; END IF;
 old_name:=req->>'source';new_name:=req->>'target';
 IF req->>'operation'='rename' THEN
  SELECT jsonb_agg(CASE WHEN x->>'name'=old_name THEN jsonb_set(x,'{name}',to_jsonb(new_name),false) ELSE x END ORDER BY pos)
  INTO new_stock FROM jsonb_array_elements(st.data->'stock') WITH ORDINALITY t(x,pos);
 ELSE
  SELECT jsonb_agg(CASE WHEN x->>'name'=new_name THEN jsonb_set(x,'{qty}',plan->'proposedQty',false) ELSE x END ORDER BY pos)
  INTO new_stock FROM jsonb_array_elements(st.data->'stock') WITH ORDINALITY t(x,pos) WHERE x->>'name' IS DISTINCT FROM old_name;
 END IF;
 SELECT coalesce(jsonb_object_agg(e.key,(SELECT coalesce(jsonb_agg(CASE WHEN x->>'item'=old_name THEN jsonb_set(x,'{item}',to_jsonb(new_name),false) ELSE x END ORDER BY pos),'[]')
 FROM jsonb_array_elements(e.value) WITH ORDINALITY t(x,pos))),'{}') INTO new_recipes FROM jsonb_each(st.data->'productRecipes') e;
 next_data:=jsonb_build_object('stock',new_stock,'productRecipes',new_recipes);
 UPDATE public.artessencia_v1_state SET data=st.data||next_data,revision=st.revision+1,updated_at=stamp,device_id='intelligence-server' WHERE user_id=actor RETURNING * INTO st;
 INSERT INTO artessencia_intelligence_private.stock_change_receipts VALUES(actor,op_id,mid,req,plan,previous_data,next_data,current_digest,st.revision,stamp,NULL);
 RETURN jsonb_build_object('status','confirmed','revision',st.revision,'replayed',false);
END;
$stockcommit$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.stock_change_commit(text,jsonb) FROM PUBLIC,anon,authenticated;

-- Internal commercial drafts, never customer communications or canonical quote writes.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.commercial_proposals(
 user_id uuid NOT NULL,mission_id uuid NOT NULL,proposal_index integer NOT NULL CHECK(proposal_index BETWEEN 0 AND 39),
 source_kind text NOT NULL CHECK(source_kind IN ('quote','request')),source_id uuid NOT NULL,
 reference text NOT NULL,source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 instruction text NOT NULL CHECK(length(instruction) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,mission_id,proposal_index),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.commercial_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.commercial_proposals FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.commercial_source(p_kind text,p_id uuid,p_lock boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $commercialsource$
DECLARE actor uuid:=auth.uid(); source_digest text;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF p_kind='quote' THEN
  IF p_lock THEN PERFORM 1 FROM public.artessencia_v1_quotes WHERE user_id=actor AND id=p_id FOR UPDATE; END IF;
  SELECT encode(sha256(convert_to(to_jsonb(q)::text,'UTF8')),'hex') INTO source_digest FROM public.artessencia_v1_quotes q
   WHERE q.user_id=actor AND q.id=p_id AND q.status IN ('Rascunho','Enviado','Aceite') AND coalesce(q.data->>'orderId','')='';
 ELSIF p_kind='request' THEN
  IF p_lock THEN PERFORM 1 FROM public.artessencia_shop_event_requests WHERE user_id=actor AND request_id=p_id FOR UPDATE; END IF;
  SELECT encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') INTO source_digest FROM public.artessencia_shop_event_requests r
   WHERE r.user_id=actor AND r.request_id=p_id AND r.status='new';
 ELSE RAISE EXCEPTION 'COMMERCIAL_SOURCE_INVALID'; END IF;
 RETURN source_digest;
END;
$commercialsource$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.commercial_source(text,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.commercial_command(p_action text,p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $commercial$
DECLARE actor uuid:=auth.uid(); mid uuid; idx integer; proposal jsonb; saved artessencia_intelligence_private.commercial_proposals%rowtype;
 sid uuid; digest text; kind text;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF p_action='read' THEN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('mission',z.mission_id,'index',z.proposal_index,'kind',z.source_kind,'reference',z.reference,
   'instruction',z.instruction,'createdAt',z.created_at,'current',coalesce(artessencia_intelligence_private.commercial_source(z.source_kind,z.source_id)=z.source_digest,false)) ORDER BY z.created_at DESC),'[]')
   FROM (SELECT * FROM artessencia_intelligence_private.commercial_proposals WHERE user_id=actor ORDER BY created_at DESC LIMIT 100)z);
 END IF;
 IF p_action<>'approve' OR p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR coalesce(p_args->>'index','') !~ '^[0-9]{1,2}$' THEN RAISE EXCEPTION 'COMMERCIAL_CONFIRMATION_REQUIRED'; END IF;
 mid:=(p_args->>'mission')::uuid;idx:=(p_args->>'index')::integer;
 IF idx NOT BETWEEN 0 AND 39 THEN RAISE EXCEPTION 'COMMERCIAL_PROPOSAL_INVALID'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.team_controls c JOIN artessencia_intelligence_private.team_missions m USING(user_id)
  WHERE c.user_id=actor AND c.enabled AND c.modes->>'comercial'<>'off' AND c.revision=m.control_revision
  AND m.mission_id=mid AND m.agent='comercial' AND m.kind='commercial_review' AND m.status='review_ready' FOR UPDATE OF c,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_NOT_AUTHORIZED'; END IF;
 SELECT * INTO saved FROM artessencia_intelligence_private.commercial_proposals z WHERE z.user_id=actor AND z.mission_id=mid AND z.proposal_index=idx;
 IF FOUND THEN RETURN jsonb_build_object('status','confirmed','mission',mid,'index',idx,'replayed',true); END IF;
 SELECT r.outcome->'report'->'commercialProposals'->idx INTO proposal FROM artessencia_intelligence_private.team_runs r
  WHERE r.user_id=actor AND r.mission_id=mid AND r.status='review_ready';
 IF proposal->'requiresApproval' IS DISTINCT FROM 'true'::jsonb OR coalesce(proposal->>'sourceDigest','') !~ '^[0-9a-f]{64}$'
 OR coalesce(proposal->>'reference','') !~ '^[A-Za-z0-9_-]{1,70}$'
 OR coalesce(length(trim(proposal->>'instruction')),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'COMMERCIAL_PROPOSAL_INVALID'; END IF;
 sid:=(proposal->>'recordId')::uuid;kind:=proposal->>'kind';
 digest:=artessencia_intelligence_private.commercial_source(kind,sid,true);
 IF digest IS NULL OR digest IS DISTINCT FROM proposal->>'sourceDigest' THEN RAISE EXCEPTION 'COMMERCIAL_SOURCE_STALE'; END IF;
 INSERT INTO artessencia_intelligence_private.commercial_proposals(user_id,mission_id,proposal_index,source_kind,source_id,reference,source_digest,instruction)
  VALUES(actor,mid,idx,kind,sid,proposal->>'reference',digest,proposal->>'instruction');
 RETURN jsonb_build_object('status','confirmed','mission',mid,'index',idx,'replayed',false);
END;
$commercial$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.commercial_command(text,jsonb) FROM PUBLIC,anon,authenticated;
-- Professional assessment is an owner review of a completed document, not a permission grant.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.professional_assessments(
 user_id uuid NOT NULL,assessment_id uuid NOT NULL,mission_id uuid NOT NULL,
 agent text NOT NULL,training_version text NOT NULL,training_digest text NOT NULL,
 evidence_kind text NOT NULL CHECK(evidence_kind IN ('simulation','provider_unverified')),
 evidence_digest text NOT NULL,
 scores jsonb NOT NULL,score numeric(5,2) NOT NULL CHECK(score BETWEEN 0 AND 100),
 critical boolean NOT NULL,feedback text NOT NULL CHECK(length(feedback) BETWEEN 1 AND 2000),
 verdict text NOT NULL CHECK(verdict IN ('review_pass','needs_training')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,assessment_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.professional_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.professional_assessments FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.professional_assess(p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $assessment$
DECLARE
 actor uuid:=auth.uid(); aid uuid:=(p_args->>'id')::uuid; mid uuid:=(p_args->>'mission')::uuid;
 marks jsonb:=p_args->'scores'; critical_flag boolean; notes text:=trim(p_args->>'feedback');
 result jsonb; training jsonb; department text; model_id text; evidence_hash text;
 weighted numeric; decision text; k text; prior artessencia_intelligence_private.professional_assessments%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF aid IS NULL OR mid IS NULL OR p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_args->'critical') IS DISTINCT FROM 'boolean'
 OR coalesce(length(notes),0) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(marks) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'ASSESSMENT_INVALID'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(marks))<>5 THEN RAISE EXCEPTION 'ASSESSMENT_INVALID'; END IF;
 FOREACH k IN ARRAY ARRAY['technical','procedures','quality','safety','efficiency'] LOOP
  IF jsonb_typeof(marks->k) IS DISTINCT FROM 'number' OR coalesce(marks->>k,'') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'ASSESSMENT_INVALID'; END IF;
  IF (marks->>k)::integer NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'ASSESSMENT_INVALID'; END IF;
 END LOOP;
 critical_flag:=(p_args->>'critical')::boolean;
 weighted:=((marks->>'technical')::numeric*30+(marks->>'procedures')::numeric*25+(marks->>'quality')::numeric*20+(marks->>'safety')::numeric*15+(marks->>'efficiency')::numeric*10)/100;
 decision:=CASE WHEN weighted>=85 AND NOT critical_flag AND (marks->>'safety')::integer>=85 THEN 'review_pass' ELSE 'needs_training' END;
 -- Serialize evaluation of the same immutable mission. No change to controls, modes or budget.
 PERFORM 1 FROM artessencia_intelligence_private.team_missions m WHERE m.user_id=actor AND m.mission_id=mid AND m.status='review_ready' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSESSMENT_MISSION_UNAVAILABLE'; END IF;
 SELECT r.outcome,m.agent,e.model INTO result,department,model_id
 FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id)
 JOIN artessencia_intelligence_private.ai_budget_entries e USING(request_id)
 WHERE r.user_id=actor AND r.mission_id=mid AND r.status='review_ready' AND e.status='settled';
 training:=result#>'{report,professionalTraining}';
 IF training->>'agent' IS DISTINCT FROM department OR department IS NULL OR training->>'kind' IS DISTINCT FROM 'instructions_applied'
 OR coalesce(training->>'version','') !~ '^AE-FORM-[0-9]+[.][0-9]+[.][0-9]+$' OR coalesce(training->>'digest','') !~ '^[0-9a-f]{64}$'
 OR coalesce(length(result->>'reasoning'),0)=0 THEN RAISE EXCEPTION 'ASSESSMENT_EVIDENCE_UNAVAILABLE'; END IF;
 evidence_hash:=encode(sha256(convert_to(result::text,'UTF8')),'hex');
 SELECT * INTO prior FROM artessencia_intelligence_private.professional_assessments z WHERE z.user_id=actor AND z.assessment_id=aid;
 IF FOUND THEN
  IF prior.mission_id<>mid OR prior.scores IS DISTINCT FROM marks OR prior.critical<>critical_flag OR prior.feedback<>notes OR prior.evidence_digest<>evidence_hash THEN RAISE EXCEPTION 'ASSESSMENT_RECEIPT_CONFLICT'; END IF;
  RETURN jsonb_build_object('status','recorded','score',prior.score,'verdict',prior.verdict,'replayed',true);
 END IF;
 INSERT INTO artessencia_intelligence_private.professional_assessments(user_id,assessment_id,mission_id,agent,training_version,training_digest,evidence_kind,evidence_digest,scores,score,critical,feedback,verdict)
 VALUES(actor,aid,mid,department,training->>'version',training->>'digest',CASE WHEN model_id='artessencia-simulation-v1' THEN 'simulation' ELSE 'provider_unverified' END,evidence_hash,marks,weighted,critical_flag,notes,decision);
 RETURN jsonb_build_object('status','recorded','score',weighted,'verdict',decision,'replayed',false);
END;
$assessment$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.professional_assess(jsonb) FROM PUBLIC,anon,authenticated;
-- Explicit lesson approval linked to a real assessment. Do not copy the lesson text
-- to this link table: revocation and erasure remain in the existing memory module.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.professional_lesson_links(
 user_id uuid NOT NULL,assessment_id uuid NOT NULL,memory_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,assessment_id),UNIQUE(user_id,memory_id),
 FOREIGN KEY(user_id,assessment_id) REFERENCES artessencia_intelligence_private.professional_assessments(user_id,assessment_id)
);
ALTER TABLE artessencia_intelligence_private.professional_lesson_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.professional_lesson_links FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.professional_lesson(p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $lesson$
DECLARE
 actor uuid:=auth.uid(); aid uuid:=(p_args->>'assessment')::uuid; note text:=trim(p_args->>'summary');
 assessment artessencia_intelligence_private.professional_assessments%rowtype;
 existing_link artessencia_intelligence_private.professional_lesson_links%rowtype;
 mem artessencia_intelligence_private.team_memory%rowtype; mid uuid;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF aid IS NULL OR p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR coalesce(length(note),0) NOT BETWEEN 1 AND 1000
 OR note ~* '(@|Bearer[[:space:]]|sk-|sb_secret_|[0-9]{9})' THEN RAISE EXCEPTION 'LESSON_INVALID'; END IF;
 -- Serialize approval against another lesson of the same owner.
 PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_OWNER_UNAVAILABLE'; END IF;
 SELECT * INTO assessment FROM artessencia_intelligence_private.professional_assessments z WHERE z.user_id=actor AND z.assessment_id=aid FOR UPDATE;
 IF NOT FOUND OR assessment.verdict<>'needs_training' THEN RAISE EXCEPTION 'LESSON_ASSESSMENT_REQUIRED'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=assessment.mission_id AND agent=assessment.agent AND status='review_ready';
 IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_EVIDENCE_UNAVAILABLE'; END IF;
 SELECT * INTO existing_link FROM artessencia_intelligence_private.professional_lesson_links z WHERE z.user_id=actor AND z.assessment_id=aid;
 IF FOUND THEN
  SELECT * INTO mem FROM artessencia_intelligence_private.team_memory WHERE user_id=actor AND memory_id=existing_link.memory_id FOR UPDATE;
  IF NOT FOUND OR mem.revoked_at IS NOT NULL OR mem.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'LESSON_NO_LONGER_ACTIVE'; END IF;
  IF mem.summary IS DISTINCT FROM note THEN RAISE EXCEPTION 'LESSON_RECEIPT_CONFLICT'; END IF;
  RETURN jsonb_build_object('status','recorded','memoryId',mem.memory_id,'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_memory m WHERE m.user_id=actor AND m.agent=assessment.agent AND m.revoked_at IS NULL AND m.expires_at>clock_timestamp()
 AND lower(trim(m.summary))=lower(note)) THEN RAISE EXCEPTION 'LESSON_ALREADY_EXISTS'; END IF;
 mid:=gen_random_uuid();
 INSERT INTO artessencia_intelligence_private.team_memory(user_id,memory_id,agent,kind,summary,evidence_id,expires_at)
 VALUES(actor,mid,assessment.agent,'lesson',note,assessment.mission_id,clock_timestamp()+interval '364 days');
 INSERT INTO artessencia_intelligence_private.professional_lesson_links(user_id,assessment_id,memory_id) VALUES(actor,aid,mid);
 RETURN jsonb_build_object('status','recorded','memoryId',mid,'replayed',false);
END;
$lesson$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.professional_lesson(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_console_v1(p_action text, p_args jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $console$
DECLARE
 actor uuid := auth.uid();
 controls jsonb;
 missions jsonb;
 memory jsonb;
 events jsonb;
 expenses jsonb;
 selected_agent text := p_args->>'agent';
 memory_text text := trim(p_args->>'summary');
 target uuid;
 task_record jsonb;
 task_id text;
 task_agent text;
 existing_task record;
 task_time timestamptz := clock_timestamp();
 canonical_state public.artessencia_v1_state%rowtype;
 material_proposal jsonb;
 material_receipt artessencia_intelligence_private.material_creation_receipts%rowtype;
 material_name text;
 material_unit text;
 material_cost numeric;
 material_index integer;
 material_revision bigint;
 material_row jsonb;
 recipe_receipt artessencia_intelligence_private.recipe_reference_receipts%rowtype;
 recipe_code text;
 recipe_line integer;
 recipe_rows jsonb;
 recipe_row jsonb;
 recipe_before text;
 recipe_after text;
 recipe_material jsonb;
 recipe_hits bigint;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED';
 END IF;
 IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' OR octet_length(p_args::text)>(CASE WHEN p_action='mission' AND p_args ? 'attachment' THEN 1500000 ELSE 24000 END) THEN RAISE EXCEPTION 'INVALID_ARGUMENTS'; END IF;
 CASE p_action
 WHEN 'controls' THEN
  RETURN artessencia_intelligence_private.team_set_controls((p_args->>'revision')::bigint,(p_args->>'enabled')::boolean,p_args->'modes');
 WHEN 'mission' THEN
  target:=(p_args->>'id')::uuid;
  task_record:=artessencia_intelligence_private.team_create_mission(target,selected_agent,p_args->>'kind',p_args->>'instruction',(p_args->>'revision')::bigint);
  IF p_args ? 'attachment' THEN
   IF selected_agent<>'stock' OR p_args->>'kind' NOT IN ('inventory_audit','stock_organization_plan') OR
    coalesce(p_args#>>'{attachment,mime}','') NOT IN ('image/png','image/jpeg','application/pdf','text/plain','text/csv') OR
    coalesce(length(p_args#>>'{attachment,content}'),0) NOT BETWEEN 4 AND 1398104 OR
    (p_args#>>'{attachment,content}') !~ '^[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION 'INVALID_ATTACHMENT'; END IF;
   INSERT INTO artessencia_intelligence_private.team_inputs VALUES(actor,target,p_args#>>'{attachment,mime}',p_args#>>'{attachment,content}',clock_timestamp()+interval '24 hours');
  END IF;
  RETURN task_record;
 WHEN 'cancel' THEN
  PERFORM artessencia_intelligence_private.team_transition((p_args->>'id')::uuid,(p_args->>'revision')::bigint,'cancelled',NULL);
  FOR existing_task IN SELECT m.mission_id,m.revision FROM artessencia_intelligence_private.team_delegations d
   JOIN artessencia_intelligence_private.team_missions m ON m.user_id=d.user_id AND m.mission_id=d.child_id
   WHERE d.user_id=actor AND d.parent_id=(p_args->>'id')::uuid AND m.status IN ('approved','working','pending_review') ORDER BY m.mission_id FOR UPDATE OF m LOOP
   PERFORM artessencia_intelligence_private.team_transition(existing_task.mission_id,existing_task.revision,'cancelled',NULL);
  END LOOP;
  UPDATE artessencia_intelligence_private.team_inputs i SET content=NULL
   FROM artessencia_intelligence_private.team_missions m WHERE m.user_id=actor AND m.mission_id=i.mission_id AND m.user_id=i.user_id AND m.status='cancelled' AND i.content IS NOT NULL;
  RETURN jsonb_build_object('status','cancelled');
 WHEN 'approve' THEN
  RETURN artessencia_intelligence_private.team_transition((p_args->>'id')::uuid,(p_args->>'revision')::bigint,
   'approved',NULL);
 WHEN 'delegate' THEN
  PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor AND enabled AND modes->>'director'<>'off' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTOR_DISABLED'; END IF;
  PERFORM 1 FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=(p_args->>'parent')::uuid AND agent='director'
   AND status IN ('approved','working') AND control_revision=(p_args->>'revision')::bigint FOR UPDATE;
  IF NOT FOUND OR selected_agent='director' THEN RAISE EXCEPTION 'DELEGATION_DENIED'; END IF;
  target:=(p_args->>'id')::uuid;
  PERFORM artessencia_intelligence_private.team_create_mission(target,selected_agent,p_args->>'kind',p_args->>'instruction',(p_args->>'revision')::bigint);
  INSERT INTO artessencia_intelligence_private.team_delegations VALUES(actor,(p_args->>'parent')::uuid,target,selected_agent);
  RETURN jsonb_build_object('id',target);
 WHEN 'routine' THEN
  PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor AND revision=(p_args->>'revision')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_REVISION_CONFLICT'; END IF;
  IF jsonb_typeof(p_args->'enabled') IS DISTINCT FROM 'boolean' OR length(trim(p_args->>'instruction')) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'INVALID_ROUTINE'; END IF;
  INSERT INTO artessencia_intelligence_private.team_routines(user_id,agent,cadence,kind,instruction,enabled)
  VALUES(actor,selected_agent,p_args->>'cadence',CASE selected_agent WHEN 'director' THEN 'daily_priority_plan' WHEN 'stock' THEN 'inventory_audit' WHEN 'producao' THEN 'production_plan'
   WHEN 'financeiro' THEN 'finance_review' WHEN 'marketing' THEN 'marketing_plan' WHEN 'comercial' THEN 'commercial_review' WHEN 'catalogo' THEN 'catalog_review'
   WHEN 'inovacao' THEN 'innovation_review' WHEN 'auditoria' THEN 'technical_review' END,p_args->>'instruction',(p_args->>'enabled')::boolean)
  ON CONFLICT(user_id,agent,cadence) DO UPDATE SET instruction=excluded.instruction,enabled=excluded.enabled;
  RETURN jsonb_build_object('agent',selected_agent);
 WHEN 'professional_lesson' THEN
  RETURN artessencia_intelligence_private.professional_lesson(p_args);
 WHEN 'professional_assess' THEN
  RETURN artessencia_intelligence_private.professional_assess(p_args);
 WHEN 'commercial_read' THEN
  RETURN artessencia_intelligence_private.commercial_command('read',p_args);
 WHEN 'commercial_approve' THEN
  RETURN artessencia_intelligence_private.commercial_command('approve',p_args);
 WHEN 'stock_change_preview' THEN
  RETURN artessencia_intelligence_private.stock_change_preview(p_args);
 WHEN 'stock_change_apply' THEN
  RETURN artessencia_intelligence_private.stock_change_commit('apply',p_args);
 WHEN 'stock_change_revert' THEN
  RETURN artessencia_intelligence_private.stock_change_commit('revert',p_args);
 WHEN 'create_material' THEN
  IF p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_args->'unitCost') IS DISTINCT FROM 'number'
   OR coalesce(p_args->>'index','') !~ '^[0-9]{1,2}$' OR coalesce(p_args->>'sourceRevision','') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'MATERIAL_CONFIRMATION_REQUIRED'; END IF;
  target:=(p_args->>'mission')::uuid; material_index:=(p_args->>'index')::integer;
  material_revision:=(p_args->>'sourceRevision')::bigint; material_cost:=(p_args->>'unitCost')::numeric;
  IF material_cost<=0 OR material_cost>1000000 THEN RAISE EXCEPTION 'MATERIAL_COST_INVALID'; END IF;
  PERFORM 1 FROM artessencia_intelligence_private.team_controls c JOIN artessencia_intelligence_private.team_missions m USING(user_id)
   WHERE c.user_id=actor AND m.mission_id=target AND m.agent='stock' AND m.status='review_ready'
     AND c.enabled AND c.modes->>'stock'<>'off' AND c.revision=m.control_revision FOR UPDATE OF c,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_NOT_AUTHORIZED'; END IF;
  SELECT * INTO canonical_state FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
  SELECT * INTO material_receipt FROM artessencia_intelligence_private.material_creation_receipts
   WHERE user_id=actor AND mission_id=target AND line_index=material_index;
  IF FOUND THEN
   IF material_receipt.source_revision<>material_revision OR (material_receipt.material->>'unitCost')::numeric<>material_cost THEN RAISE EXCEPTION 'MATERIAL_RECEIPT_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','confirmed','material',material_receipt.material,'revision',material_receipt.committed_revision,'replayed',true);
  END IF;
  SELECT r.outcome->'report'->'physicalCount' INTO material_proposal FROM artessencia_intelligence_private.team_runs r
   WHERE r.user_id=actor AND r.mission_id=target AND r.status='review_ready';
  IF material_proposal->>'mode' IS DISTINCT FROM 'physical_count_proposal_only' OR material_proposal->>'sourceRevision' IS DISTINCT FROM material_revision::text THEN RAISE EXCEPTION 'MATERIAL_PROPOSAL_STALE'; END IF;
  material_proposal:=material_proposal->'proposals'->material_index;
  IF material_proposal->>'status' IS DISTINCT FROM 'new_material_review' OR material_proposal->>'index' IS DISTINCT FROM material_index::text
   OR material_proposal->'requiresApproval' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'MATERIAL_PROPOSAL_INVALID'; END IF;
  material_name:=material_proposal->>'name'; material_unit:=material_proposal->>'unit';
  IF material_name IS NULL OR length(material_name) NOT BETWEEN 1 AND 200 OR trim(material_name)<>material_name
   OR material_name ~ '[[:cntrl:]<>"'']' OR material_name ~ '&[[:alnum:]#]+;' OR material_name IN ('__proto__','constructor','prototype')
   OR material_unit IS NULL OR material_unit NOT IN ('g','ml','cm','un') THEN RAISE EXCEPTION 'MATERIAL_INVALID'; END IF;
  IF canonical_state.revision IS DISTINCT FROM material_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
  IF jsonb_typeof(canonical_state.data->'stock') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(canonical_state.data->'stock') x WHERE
    artessencia_intelligence_private.material_name_key(x->>'name')=artessencia_intelligence_private.material_name_key(material_name)) THEN RAISE EXCEPTION 'MATERIAL_ALREADY_EXISTS'; END IF;
  material_row:=jsonb_build_object('name',material_name,'unit',material_unit,'qty',0,'min',0,'target',NULL,'unitCost',material_cost,'preferredSupplier','','imageUrl','');
  UPDATE public.artessencia_v1_state SET data=jsonb_set(canonical_state.data,'{stock}',(canonical_state.data->'stock')||jsonb_build_array(material_row)),
   revision=canonical_state.revision+1,updated_at=task_time,device_id='intelligence-server'
   WHERE user_id=actor RETURNING * INTO canonical_state;
  INSERT INTO artessencia_intelligence_private.material_creation_receipts VALUES(actor,target,material_index,material_row,material_revision,canonical_state.revision,task_time);
  RETURN jsonb_build_object('status','confirmed','material',material_row,'revision',canonical_state.revision,'replayed',false);
 WHEN 'repair_recipe_reference' THEN
  IF p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR coalesce(p_args->>'index','') !~ '^[0-9]{1,2}$'
   OR coalesce(p_args->>'sourceRevision','') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'REFERENCE_CONFIRMATION_REQUIRED'; END IF;
  target:=(p_args->>'mission')::uuid; material_index:=(p_args->>'index')::integer; material_revision:=(p_args->>'sourceRevision')::bigint;
  PERFORM 1 FROM artessencia_intelligence_private.team_controls c JOIN artessencia_intelligence_private.team_missions m USING(user_id)
   WHERE c.user_id=actor AND m.mission_id=target AND m.agent='stock' AND m.kind='inventory_audit' AND m.status='review_ready'
   AND c.enabled AND c.modes->>'stock'<>'off' AND c.revision=m.control_revision FOR UPDATE OF c,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'REFERENCE_NOT_AUTHORIZED'; END IF;
  SELECT * INTO canonical_state FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
  SELECT * INTO recipe_receipt FROM artessencia_intelligence_private.recipe_reference_receipts
   WHERE user_id=actor AND mission_id=target AND proposal_index=material_index;
  IF FOUND THEN
   IF recipe_receipt.source_revision<>material_revision THEN RAISE EXCEPTION 'REFERENCE_RECEIPT_CONFLICT'; END IF;
   RETURN jsonb_build_object('status','confirmed','revision',recipe_receipt.committed_revision,'replayed',true);
  END IF;
  SELECT r.outcome->'report'->'referenceRepairs' INTO material_proposal FROM artessencia_intelligence_private.team_runs r
   WHERE r.user_id=actor AND r.mission_id=target AND r.status='review_ready';
  IF material_proposal->>'mode' IS DISTINCT FROM 'reference_repair_only' OR material_proposal->>'sourceRevision' IS DISTINCT FROM material_revision::text THEN RAISE EXCEPTION 'REFERENCE_PROPOSAL_STALE'; END IF;
  material_proposal:=material_proposal->'proposals'->material_index;
  IF material_index NOT BETWEEN 0 AND 49 OR material_proposal->'requiresApproval' IS DISTINCT FROM 'true'::jsonb
   OR coalesce(material_proposal->>'line','') !~ '^[0-9]{1,7}$' THEN RAISE EXCEPTION 'REFERENCE_PROPOSAL_INVALID'; END IF;
  recipe_code:=material_proposal->>'code'; recipe_line:=(material_proposal->>'line')::integer;
  recipe_before:=material_proposal->>'before'; recipe_after:=material_proposal->>'after';
  IF recipe_code IS NULL OR recipe_before IS NULL OR recipe_after IS NULL OR recipe_before=recipe_after
   OR length(recipe_before) NOT BETWEEN 1 AND 200 OR length(recipe_after) NOT BETWEEN 1 AND 200
   OR artessencia_intelligence_private.material_name_key(recipe_before) IS DISTINCT FROM artessencia_intelligence_private.material_name_key(recipe_after)
   OR artessencia_intelligence_private.material_name_key(recipe_before)='' THEN RAISE EXCEPTION 'REFERENCE_PROPOSAL_INVALID'; END IF;
  IF canonical_state.revision IS DISTINCT FROM material_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
  IF jsonb_typeof(canonical_state.data->'stock') IS DISTINCT FROM 'array' OR jsonb_typeof(canonical_state.data->'productRecipes') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  PERFORM 1 FROM public.artessencia_v1_products WHERE user_id=actor AND data->>'code'=recipe_code FOR UPDATE;
  IF (SELECT count(*) FROM public.artessencia_v1_products WHERE user_id=actor AND data->>'code'=recipe_code)<>1
   OR EXISTS(SELECT 1 FROM public.artessencia_v1_products WHERE user_id=actor AND data->>'code'=recipe_code AND data ? 'recipe' AND data->'recipe' NOT IN ('null'::jsonb,'[]'::jsonb)) THEN RAISE EXCEPTION 'REFERENCE_PRODUCT_AMBIGUOUS'; END IF;
  recipe_rows:=canonical_state.data->'productRecipes'->recipe_code; recipe_row:=recipe_rows->recipe_line;
  IF jsonb_typeof(recipe_rows) IS DISTINCT FROM 'array' OR recipe_row->>'item' IS DISTINCT FROM recipe_before
   OR recipe_row->'qty' IS DISTINCT FROM material_proposal->'quantity' THEN RAISE EXCEPTION 'REFERENCE_ROW_CHANGED'; END IF;
  SELECT count(*),jsonb_agg(x)->0 INTO recipe_hits,recipe_material FROM jsonb_array_elements(canonical_state.data->'stock') x
   WHERE artessencia_intelligence_private.material_name_key(x->>'name')=artessencia_intelligence_private.material_name_key(recipe_before);
  IF recipe_hits<>1 OR recipe_material->>'name' IS DISTINCT FROM recipe_after
   OR recipe_material->>'unit' IS DISTINCT FROM material_proposal->>'unit' OR recipe_material->'unitCost' IS DISTINCT FROM material_proposal->'unitCost'
   OR coalesce(recipe_material->>'unit','') NOT IN ('g','ml','cm','un') OR coalesce(recipe_material->>'unitCost','') !~ '^[0-9]+([.][0-9]+)?$'
   OR coalesce(recipe_row->>'qty','') !~ '^[0-9]+([.][0-9]+)?$' OR coalesce(recipe_row->>'unit','') NOT IN ('',recipe_material->>'unit') THEN RAISE EXCEPTION 'REFERENCE_MATERIAL_CHANGED'; END IF;
  IF (recipe_material->>'unitCost')::numeric<=0 OR (recipe_row->>'qty')::numeric<=0 THEN RAISE EXCEPTION 'REFERENCE_MATERIAL_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(recipe_rows) WITH ORDINALITY t(x,pos)
   WHERE pos<>recipe_line+1 AND artessencia_intelligence_private.material_name_key(x->>'item')=artessencia_intelligence_private.material_name_key(recipe_after)) THEN RAISE EXCEPTION 'REFERENCE_DUPLICATE_LINE'; END IF;
  UPDATE public.artessencia_v1_state SET data=jsonb_set(canonical_state.data,ARRAY['productRecipes',recipe_code,recipe_line::text,'item'],to_jsonb(recipe_after),false),
   revision=canonical_state.revision+1,updated_at=task_time,device_id='intelligence-server' WHERE user_id=actor RETURNING * INTO canonical_state;
  INSERT INTO artessencia_intelligence_private.recipe_reference_receipts VALUES(actor,target,material_index,material_proposal,material_revision,canonical_state.revision,task_time);
  RETURN jsonb_build_object('status','confirmed','revision',canonical_state.revision,'replayed',false);
 WHEN 'plan_task' THEN
  SELECT m.agent INTO task_agent FROM artessencia_intelligence_private.team_controls c
   JOIN artessencia_intelligence_private.team_missions m USING(user_id)
   WHERE c.user_id=actor AND c.enabled AND c.modes->>m.agent<>'off' AND m.mission_id=(p_args->>'mission')::uuid AND m.status='review_ready' FOR UPDATE OF c,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_AUTHORIZED'; END IF;
  SELECT task INTO STRICT task_record FROM artessencia_intelligence_private.team_runs r,
   LATERAL jsonb_array_elements(r.outcome->'report'->'tasks') task
   WHERE r.user_id=actor AND r.mission_id=(p_args->>'mission')::uuid AND r.status='review_ready'
    AND task->>'agent'=task_agent AND task->>'key'=p_args->>'key' AND task->'requiresApproval'='true'::jsonb;
  IF length(trim(task_record->>'title')) NOT BETWEEN 1 AND 160 OR task_record->>'priority' NOT IN ('1','2','3') THEN RAISE EXCEPTION 'INVALID_TASK'; END IF;
  task_id:='ae-intel-'||encode(sha256(convert_to(jsonb_build_array(actor,task_agent,task_record->>'key')::text,'UTF8')),'hex');
  INSERT INTO public.artessencia_cloud_records(user_id,entity,record_id,data,client_updated_at,device_id)
  VALUES(actor,'operational_tasks_v1',task_id,jsonb_build_object('id',task_id,'kind','task','title',task_record->>'title',
   'category',CASE task_agent WHEN 'marketing' THEN 'Marketing' WHEN 'comercial' THEN 'Comercial' WHEN 'producao' THEN 'Produção' WHEN 'inovacao' THEN 'Criação' WHEN 'auditoria' THEN 'Segurança' ELSE 'Gestão' END,
   'status','pendente','source','intelligence','priority',CASE task_record->>'priority' WHEN '1' THEN 'alta' WHEN '2' THEN 'normal' ELSE 'baixa' END,
   'due_date',(task_record->>'dueDate')::date,'intelligence_agent',task_agent,'intelligence_mission_id',p_args->>'mission',
   'intelligence_semantic_key',task_record->>'key','createdAt',task_time,'updatedAt',task_time),task_time,'intelligence-server')
  ON CONFLICT(user_id,entity,record_id) DO NOTHING;
  SELECT data,deleted_at INTO STRICT existing_task FROM public.artessencia_cloud_records WHERE user_id=actor AND entity='operational_tasks_v1' AND record_id=task_id;
  IF existing_task.data->>'intelligence_semantic_key' IS DISTINCT FROM task_record->>'key' THEN RAISE EXCEPTION 'TASK_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',task_id,'status',CASE WHEN existing_task.deleted_at IS NULL THEN 'confirmed' ELSE 'archived' END);
 WHEN 'correct' THEN
  IF memory_text IS NULL OR length(memory_text) NOT BETWEEN 1 AND 1000 OR memory_text ~* '(@|Bearer[[:space:]]|sk-|sb_secret_|[0-9]{9})' THEN RAISE EXCEPTION 'INVALID_MEMORY'; END IF;
  UPDATE artessencia_intelligence_private.team_memory SET summary=memory_text
   WHERE user_id=actor AND memory_id=(p_args->>'id')::uuid AND revoked_at IS NULL AND expires_at>clock_timestamp() AND summary=p_args->>'previous';
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMORY_STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',p_args->>'id');
 WHEN 'remember' THEN
  IF memory_text IS NULL OR length(memory_text) NOT BETWEEN 1 AND 1000 OR memory_text ~* '(@|Bearer[[:space:]]|sk-|sb_secret_|[0-9]{9})' THEN RAISE EXCEPTION 'INVALID_MEMORY'; END IF;
  target := (p_args->>'id')::uuid;
  INSERT INTO artessencia_intelligence_private.team_memory(user_id,memory_id,agent,kind,summary,evidence_id,expires_at)
  SELECT actor,target,m.agent,p_args->>'kind',memory_text,m.mission_id,clock_timestamp()+interval '364 days'
  FROM artessencia_intelligence_private.team_missions m
  WHERE m.user_id=actor AND m.mission_id=(p_args->>'mission')::uuid AND m.agent=selected_agent AND m.status='review_ready';
  IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
  RETURN jsonb_build_object('id',target);
 WHEN 'revoke','erase' THEN
  target := (p_args->>'id')::uuid;
  IF p_action='revoke' THEN
   UPDATE artessencia_intelligence_private.team_memory SET revoked_at=clock_timestamp() WHERE user_id=actor AND memory_id=target AND revoked_at IS NULL;
  ELSE
   DELETE FROM artessencia_intelligence_private.team_memory WHERE user_id=actor AND memory_id=target AND revoked_at IS NOT NULL;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMORY_STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',target);
 WHEN 'read' THEN
  SELECT jsonb_build_object('revision',revision,'enabled',enabled,'modes',modes) INTO controls
  FROM artessencia_intelligence_private.team_controls WHERE user_id=actor;
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.updated_at DESC,m.mission_id),'[]') INTO missions FROM
   (SELECT m.mission_id,m.agent,m.kind,m.instruction,m.status,m.revision,m.updated_at,m.result_summary,d.parent_id FROM artessencia_intelligence_private.team_missions m LEFT JOIN artessencia_intelligence_private.team_delegations d ON d.user_id=m.user_id AND d.child_id=m.mission_id WHERE m.user_id=actor ORDER BY updated_at DESC,mission_id LIMIT 100) m;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC),'[]') INTO events FROM
   (SELECT mission_id,revision,status,occurred_at FROM artessencia_intelligence_private.team_events WHERE user_id=actor ORDER BY occurred_at DESC LIMIT 100) e;
  SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.created_at DESC),'[]') INTO memory FROM
   (SELECT memory_id,agent,summary,kind,evidence_id,created_at,expires_at,revoked_at FROM artessencia_intelligence_private.team_memory WHERE user_id=actor AND expires_at>clock_timestamp() ORDER BY created_at DESC LIMIT 100) k;
  SELECT jsonb_build_object('pending',coalesce(sum(maximum_microeur) FILTER(WHERE status IN ('reserved','unknown','inflight')),0),
   'settled',coalesce(sum(actual_microeur) FILTER(WHERE status='settled' AND date_trunc('month',now() AT TIME ZONE 'Europe/Lisbon')::date IN(reserved_month,settled_month)),0),
   'unknown',count(*) FILTER(WHERE status='unknown'),'staleInflight',count(*) FILTER(WHERE status='inflight' AND reserved_at<clock_timestamp()-interval '5 minutes')) INTO expenses FROM artessencia_intelligence_private.ai_budget_entries;
  expenses:=expenses||jsonb_build_object('monthlyLimitMicroeur',(SELECT monthly_limit_microeur FROM artessencia_intelligence_private.ai_budget_control WHERE singleton),'ledgerReleased',coalesce((SELECT release_enabled FROM artessencia_intelligence_private.ai_budget_control WHERE singleton),false),'ledgerFrozen',coalesce((SELECT frozen FROM artessencia_intelligence_private.ai_budget_control WHERE singleton),true));
  expenses:=expenses||jsonb_build_object('channels',(SELECT coalesce(jsonb_object_agg(channel,jsonb_build_object('settled',settled,'pending',pending)),'{}') FROM
   (SELECT channel,coalesce(sum(actual_microeur) FILTER(WHERE status='settled' AND date_trunc('month',now() AT TIME ZONE 'Europe/Lisbon')::date IN(reserved_month,settled_month)),0) settled,
    coalesce(sum(maximum_microeur) FILTER(WHERE status IN ('reserved','unknown','inflight')),0) pending FROM artessencia_intelligence_private.ai_budget_entries GROUP BY channel)t));
  RETURN jsonb_build_object('routines',(SELECT coalesce(jsonb_agg(jsonb_build_object('agent',r.agent,'cadence',r.cadence,'enabled',r.enabled,'instruction',r.instruction)),'[]') FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=actor),
   'documents',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM (SELECT r.mission_id,m.agent,r.outcome->>'reasoning' AS content,r.outcome->'report'->'tasks' AS tasks,r.outcome->'report'->'physicalCount' AS physical_count,r.outcome->'report'->'referenceRepairs' AS reference_repairs,r.tool_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('index',z.line_index,'name',z.material->>'name','revision',z.committed_revision)),'[]') FROM artessencia_intelligence_private.material_creation_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS material_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('index',z.proposal_index,'revision',z.committed_revision)),'[]') FROM artessencia_intelligence_private.recipe_reference_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS reference_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',z.operation_id,'source',z.preview->>'source','target',z.preview->>'target','operation',z.preview->>'operation','revision',z.committed_revision,'revertedRevision',z.reverted_revision) ORDER BY z.created_at DESC),'[]') FROM artessencia_intelligence_private.stock_change_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS stock_change_receipts,
    r.outcome->'report'->'commercialProposals' AS commercial_proposals,
    (SELECT coalesce(jsonb_agg(z.proposal_index),'[]') FROM artessencia_intelligence_private.commercial_proposals z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS commercial_receipts,r.outcome->'report'->'publicComparison' AS public_comparison,r.outcome->'report'->'professionalTraining' AS professional_training FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id) WHERE r.user_id=actor AND r.status='review_ready' ORDER BY r.ended_at DESC LIMIT 50)d),
   'assessments',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC,z.assessment_id),'[]') FROM
    (SELECT a.assessment_id,a.mission_id,a.agent,a.training_version,a.training_digest,a.evidence_kind,a.scores,a.score,a.critical,a.feedback,a.verdict,a.created_at,
      l.memory_id AS lesson_memory_id,
      CASE WHEN l.memory_id IS NULL THEN 'not_approved' WHEN m.memory_id IS NULL THEN 'erased' WHEN m.revoked_at IS NOT NULL THEN 'revoked' WHEN m.expires_at<=clock_timestamp() THEN 'expired' ELSE 'active' END AS lesson_status
     FROM artessencia_intelligence_private.professional_assessments a
     LEFT JOIN artessencia_intelligence_private.professional_lesson_links l ON l.user_id=a.user_id AND l.assessment_id=a.assessment_id
     LEFT JOIN artessencia_intelligence_private.team_memory m ON m.user_id=l.user_id AND m.memory_id=l.memory_id
     WHERE a.user_id=actor ORDER BY a.created_at DESC,a.assessment_id LIMIT 100)z),
   'controls',controls,'missions',missions,'events',events,'memory',memory,'budget',expenses);
 ELSE RAISE EXCEPTION 'UNKNOWN_COMMAND';
 END CASE;
END;
$console$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_console_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_console_v1(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_director_context(p_id uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $director$
DECLARE
 actor uuid:=auth.uid();
 run jsonb;
 reports jsonb;
 keys jsonb;
BEGIN
 run:=artessencia_intelligence_private.team_run_status(p_id);
 IF (run->>'active')::boolean IS DISTINCT FROM true OR (run->>'leaseId')::uuid IS DISTINCT FROM p_lease
  OR run->>'agent'<>'director' OR run->>'kind'<>'daily_priority_plan' THEN RAISE EXCEPTION 'DIRECTOR_SCOPE_DENIED'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('mode','proposal_only','tasks',items)),'[]') INTO reports FROM
 (SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('key',t->'key','agent',t->'agent','title',t->'title','priority',t->'priority','requiresApproval',t->'requiresApproval','dueDate',t->'dueDate'))
  FROM jsonb_array_elements(r.outcome->'report'->'tasks') t WHERE t->>'agent'=m.agent),'[]'::jsonb) AS items
  FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id)
  WHERE r.user_id=actor AND r.status='review_ready' AND m.agent<>'director' AND r.outcome->'report'->>'mode'='proposal_only'
  ORDER BY r.ended_at DESC LIMIT 50) recent;
 SELECT coalesce(jsonb_agg(data->>'intelligence_semantic_key'),'[]') INTO keys FROM public.artessencia_cloud_records
 WHERE user_id=actor AND entity='operational_tasks_v1' AND data->>'source'='intelligence' AND data ? 'intelligence_semantic_key';
 IF octet_length(reports::text)+octet_length(keys::text)>500000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('verified',true,'owner',actor,'agent','director','kind','daily_priority_plan','missionId',p_id,'leaseId',p_lease,'sourceRevision',(run->>'missionRevision')::bigint,
 'evidenceIds',jsonb_build_array('mission-'||p_id),'payload',jsonb_build_object('today',(clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date,'reports',reports,'existingTaskKeys',keys,'limit',30));
END;
$director$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_director_context(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-department-context-v1.sql
-- Read-only reuse of the canonical production material calculation. Parity is tested.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_order_needs(order_row public.artessencia_v1_orders,state_row public.artessencia_v1_state,p_products jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $materials$
DECLARE
 line record; ingredient jsonb; frozen jsonb; recipe jsonb; source_product jsonb; order_needs jsonb;
 name text; quantity numeric; per_unit numeric; product_count integer;
BEGIN
   order_needs := '{}';
   if jsonb_typeof(order_row.data->'items') is distinct from 'array' or jsonb_array_length(order_row.data->'items')=0 then raise exception 'EMPTY_ORDER'; end if;
   for line in select value as data,ordinality-1 as position from jsonb_array_elements(order_row.data->'items') with ordinality loop
     if coalesce(line.data->>'type','') in ('quote_discount','quote_adjustment','quote_extra') then continue; end if;
     quantity := (line.data->>'qty')::numeric;
     if quantity is null or quantity<=0 or quantity='NaN'::numeric then raise exception 'INVALID_ORDER_QUANTITY'; end if;
     select count(*),(jsonb_agg(x->'data')->0) into product_count,source_product from jsonb_array_elements(p_products) x where x->'data'->>'code'=line.data->>'code';
     if product_count=0 then
       select count(*),(jsonb_agg(x->'data')->0) into product_count,source_product from jsonb_array_elements(p_products) x where x->'data'->>'name'=line.data->>'name';
     end if;
     if product_count<>1 then raise exception 'MISSING_OR_AMBIGUOUS_PRODUCT'; end if;
     if source_product->'manufactured'='false'::jsonb then continue; end if;
     select x into frozen from jsonb_array_elements(coalesce(order_row.data#>'{technicalSnapshotV1757,lines}','[]')) x
       where (x->>'index')::integer=line.position or (coalesce(x->>'code','')<>'' and x->>'code'=line.data->>'code')
       order by ((x->>'index')::integer=line.position) desc nulls last limit 1;
     if frozen->'materialsCaptured'='true'::jsonb then recipe:=frozen->'materials';
     else recipe:=state_row.data->'productRecipes'->(source_product->>'code'); end if;
     if jsonb_typeof(recipe) is distinct from 'array' or jsonb_array_length(recipe)=0 then raise exception 'RECIPE_REQUIRED'; end if;
     for ingredient in select value from jsonb_array_elements(recipe) loop
       name:=ingredient->>'item';
       -- Match the Backoffice's frozen historical recipe alias without modifying stored recipes.
       if frozen->'materialsCaptured'='true'::jsonb and name='fragrâncias Artficium' and exists(
         select 1 from jsonb_array_elements(state_row.data->'stock') s
         where s->>'name'='Fragrância Artficium' and s->>'unit' in ('g','ml')
       ) then name:='Fragrância Artficium'; end if;
       per_unit:=case when frozen->'materialsCaptured'='true'::jsonb then (ingredient->>'qtyPerUnit')::numeric else (ingredient->>'qty')::numeric end;
       if coalesce(name,'')='' or per_unit is null or per_unit<=0 or per_unit='NaN'::numeric then raise exception 'INVALID_RECIPE'; end if;
       order_needs:=jsonb_set(order_needs,array[name],to_jsonb(coalesce((order_needs->>name)::numeric,0)+per_unit*quantity));
     end loop;
   end loop;
   name:=trim(coalesce(order_row.data->>'box',''));quantity:=greatest(0,coalesce((order_row.data->>'boxes')::numeric,0));
   if name<>'' and quantity>0 and exists(select 1 from jsonb_array_elements(state_row.data->'stock') x where x->>'name'=name) then
     order_needs:=jsonb_set(order_needs,array[name],to_jsonb(coalesce((order_needs->>name)::numeric,0)+quantity));
   end if;
 RETURN order_needs;
END;
$materials$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_order_needs(public.artessencia_v1_orders,public.artessencia_v1_state,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_department_context(p_id uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $context$
DECLARE
 actor uuid:=auth.uid();
 run jsonb;
 agent text;
 work_day date:=(statement_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 snapshot public.artessencia_v1_state%rowtype;
 sale public.artessencia_v1_orders%rowtype;
 payload jsonb;
 products jsonb;
 orders jsonb:='[]';
 materials jsonb;
 needs jsonb;
 valid boolean;
 facts jsonb:='{}';
BEGIN
 run:=artessencia_intelligence_private.team_run_status(p_id);
 IF (run->>'active')::boolean IS DISTINCT FROM true OR (run->>'leaseId')::uuid IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
 agent:=run->>'agent';
 SELECT * INTO STRICT snapshot FROM public.artessencia_v1_state WHERE user_id=actor;
 CASE agent
 WHEN 'comercial' THEN
  SELECT jsonb_build_object('today',work_day,'quotes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'status','open','followupDate',q.valid_until,'contactAllowed',false,
    'reference',CASE WHEN q.data->>'id' ~ '^[A-Za-z0-9_-]{1,70}$' THEN q.data->>'id' ELSE q.id::text END,
    'recordStatus',q.status,'sourceDigest',encode(sha256(convert_to(to_jsonb(q)::text,'UTF8')),'hex'))),'[]') FROM public.artessencia_v1_quotes q
    WHERE q.user_id=actor AND coalesce(q.data->>'orderId','')='' AND q.status IN('Rascunho','Enviado','Aceite')),
   'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.request_id,'status','unanswered','receivedDate',(r.created_at AT TIME ZONE 'Europe/Lisbon')::date,
    'reference',r.request_id::text,'recordStatus',r.status,'sourceDigest',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'))),'[]')
    FROM public.artessencia_shop_event_requests r WHERE r.user_id=actor AND r.status='new')) INTO payload;
 WHEN 'catalogo' THEN
  SELECT jsonb_build_object('products',coalesce(jsonb_agg(jsonb_build_object('code',p.data->>'code','recordId',p.id,'name',left(p.data->>'name',200),
   'catalogEligible',(p.data->'active' IS DISTINCT FROM 'false'::jsonb AND p.data->'archivedV1803' IS DISTINCT FROM 'true'::jsonb AND p.data->'shopVisible' IS DISTINCT FROM 'false'::jsonb AND p.data->'publicReleasePendingV1803' IS DISTINCT FROM 'true'::jsonb),
   'imageUrl',left(p.data->>'shopImageUrl',2500),'hasVerifiedImage',length(trim(coalesce(p.data->>'shopImageUrl','')))>0,'description',left(p.data->>'shopDescription',1000),'family',p.data->>'catalogGroupV191',
   'priceVerified',greatest((p.data->>'onlinePrice')::numeric,(p.data->>'price')::numeric)>0,
   'optionsComplete',NULL,'published',NULL)),'[]')) INTO payload
   FROM public.artessencia_v1_products p WHERE p.user_id=actor;
  facts:=jsonb_build_object('coverage','Fotografia por referência guardada. Opções e publicação pública precisam de confirmação.');
 WHEN 'marketing' THEN
  SELECT jsonb_build_object('today',work_day,'campaigns',coalesce(jsonb_agg(jsonb_build_object('id',e.id,'status',CASE WHEN e.starts_at>now() THEN 'planned' ELSE 'active' END,
   'startDate',(e.starts_at AT TIME ZONE 'Europe/Lisbon')::date,'endDate',(e.ends_at AT TIME ZONE 'Europe/Lisbon')::date,'assetsReady',NULL)),'[]'),'posts','[]'::jsonb),
   jsonb_build_object('edicoes',coalesce(jsonb_agg(jsonb_build_object('nome',left(e.name,160),'inicio',e.starts_at,'fim',e.ends_at)),'[]'),'coverage','Edições especiais. Sem medição de desempenho de anúncios neste contexto.')
   INTO payload,facts FROM public.artessencia_shop_special_editions e WHERE e.user_id=actor AND e.active AND (e.ends_at IS NULL OR e.ends_at>=now());
 WHEN 'inovacao' THEN
  SELECT jsonb_build_object('ideas',coalesce(jsonb_agg(jsonb_build_object('id',r.mission_id,'status','planned')),'[]')),
    jsonb_build_object('conceitos_anteriores',coalesce(jsonb_agg(left(r.outcome->>'reasoning',350)),'[]'),'coverage','Conceitos para revisão. Ensaios e custos sujeitos a verificação.')
   INTO payload,facts FROM (SELECT rr.* FROM artessencia_intelligence_private.team_runs rr JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id)
    WHERE rr.user_id=actor AND m.agent='inovacao' AND rr.status='review_ready' ORDER BY rr.ended_at DESC LIMIT 12)r;
 WHEN 'auditoria' THEN
  -- Owner-scoped, bounded aggregate evidence. No customer data, task titles,
  -- instructions, credentials, device identifiers, or raw state leave SQL.
  -- Only explicit pending status is interpreted; other statuses remain unclassified.
  WITH planner AS (
   SELECT data->>'status' AS status,data->>'priority' AS priority,
    lower(regexp_replace(trim(coalesce(data->>'title','')),'[[:space:]]+',' ','g')) AS norm_title
   FROM public.artessencia_cloud_records
   WHERE user_id=actor AND entity='operational_tasks_v1' AND deleted_at IS NULL
  ), task_stats AS (
   SELECT count(*) AS total,count(*) FILTER(WHERE status='pendente') AS pending,
    count(*) FILTER(WHERE status='pendente' AND priority='alta') AS high_pending,
    count(*) FILTER(WHERE status IS DISTINCT FROM 'pendente') AS other_status,
    count(*) FILTER(WHERE status='pendente' AND norm_title='') AS pending_without_title,
    count(*) FILTER(WHERE status='pendente' AND norm_title='validar sincronização cloud') AS sync_pending,
    count(*) FILTER(WHERE status='pendente' AND norm_title='validar serviço público do catálogo e loja') AS public_pending,
    (SELECT count(*) FROM (SELECT norm_title FROM planner WHERE status='pendente' AND norm_title<>'' GROUP BY norm_title HAVING count(*)>1)d) AS duplicate_title_groups
   FROM planner
  ), active_missions AS (
   SELECT tm.agent,tm.kind,tm.status,lower(regexp_replace(trim(tm.instruction),'[[:space:]]+',' ','g')) AS norm_instruction
   FROM artessencia_intelligence_private.team_missions tm WHERE tm.user_id=actor AND tm.mission_id<>p_id AND tm.status IN ('pending_review','approved','working')
  ), mission_stats AS (
   SELECT count(*) FILTER(WHERE status='pending_review') AS awaiting_approval,
    count(*) FILTER(WHERE status='approved') AS approved,
    count(*) FILTER(WHERE status='working') AS working,
    (SELECT count(*) FROM (SELECT am.agent,am.kind,am.norm_instruction FROM active_missions am GROUP BY 1,2,3 HAVING count(*)>1)d) AS duplicate_instruction_groups
   FROM active_missions
  ), run_stats AS (
   SELECT count(*) FILTER(WHERE status='blocked') AS blocked,
    count(*) FILTER(WHERE status='working' AND started_at<statement_timestamp()-interval '10 minutes') AS stale_working
   FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id<>p_id
  ), budget_stats AS (
   SELECT count(*) FILTER(WHERE status='unknown') AS unknown_charges,
    count(*) FILTER(WHERE status IN ('reserved','inflight')) AS unsettled_requests
   FROM artessencia_intelligence_private.ai_budget_entries
  )
  SELECT jsonb_build_object('checks',jsonb_build_array(
    jsonb_build_object('id','faturacao-incerta','severity','critical','status',CASE WHEN b.unknown_charges>0 THEN 'fail' ELSE 'pass' END),
    jsonb_build_object('id','execucoes-interrompidas','severity','normal','status',CASE WHEN r.blocked+r.stale_working>0 THEN 'fail' ELSE 'pass' END),
    jsonb_build_object('id','possiveis-duplicados-planeamento','severity','normal','status',CASE WHEN t.duplicate_title_groups>0 THEN 'fail' WHEN t.other_status+t.pending_without_title>0 THEN 'unknown' ELSE 'pass' END),
    jsonb_build_object('id','possiveis-duplicados-missoes','severity','normal','status',CASE WHEN m.duplicate_instruction_groups>0 THEN 'fail' ELSE 'pass' END)),
    'syncVerified',NULL,'publicServiceVerified',NULL,
    'existingWork',jsonb_build_object('syncPending',t.sync_pending,'publicPending',t.public_pending),
    'auditEvidence',jsonb_build_object('coverage','owner_cloud_aggregates_only','snapshotRevision',snapshot.revision,
      'snapshotUpdatedAt',snapshot.updated_at,'observedAt',statement_timestamp(),
      'planner',jsonb_build_object('visible',t.total,'pending',t.pending,'highPriorityPending',t.high_pending,
       'otherStatusUnclassified',t.other_status,'pendingWithoutTitle',t.pending_without_title,'possibleDuplicateTitleGroups',t.duplicate_title_groups),
      'missions',jsonb_build_object('awaitingApproval',m.awaiting_approval,'approved',m.approved,'working',m.working,'possibleDuplicateInstructionGroups',m.duplicate_instruction_groups),
      'runs',jsonb_build_object('blocked',r.blocked,'staleWorking',r.stale_working),
      'budget',jsonb_build_object('unknownCharges',b.unknown_charges,'unsettledRequests',b.unsettled_requests),
      'sync','not_tested','publicService','not_tested','duplicateMethod','exact_normalized_title_or_agent_kind_instruction_only'))
  INTO payload FROM task_stats t CROSS JOIN mission_stats m CROSS JOIN run_stats r CROSS JOIN budget_stats b;
  facts:=jsonb_build_object('coverage','Consulta agregada ao Planeamento e às missões deste titular. Estado pendente interpretado; outros estados não classificados. Correspondência textual sinaliza candidatos, não comprova duplicação nem exclui duplicados semânticos. A revisão Cloud não comprova sincronização entre dispositivos. Catálogo/Loja públicos não consultados. Não inferir funcionamento ou estado de checkout. Não propor nova tarefa de validação se já existir uma pendente correspondente.',
   'existingWork',payload->'existingWork','auditEvidence',payload->'auditEvidence','checks',payload->'checks');
 WHEN 'financeiro' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'status',o.status,'paid',o.data->'paid','delivery',o.data->'delivery',
    'total',o.total,'paymentComplete',(jsonb_typeof(o.data->'paid')='number' AND o.total IS NOT NULL))),'[]') INTO orders FROM public.artessencia_v1_orders o WHERE o.user_id=actor;
  SELECT coalesce(jsonb_agg(jsonb_build_object('code',p.data->'code','price',p.data->'price','laborMinutes',p.data->'laborMinutes','otherCost',p.data->'otherCost','availabilityType',p.data->'availabilityType','editionExclusive',p.data->'editionExclusive','marginPct',p.data->'marginPct','profitPct',p.data->'profitPct')),'[]') INTO products FROM public.artessencia_v1_products p WHERE p.user_id=actor;
  SELECT jsonb_build_object('today',work_day,'orders',orders,'products',products,'settings',(SELECT coalesce(jsonb_object_agg(k,v),'{}') FROM jsonb_each(snapshot.data->'settings') s(k,v) WHERE k IN('pricingDefaultMarginPct','pricingGlobalWastePctV1802','pricingLaborMode','pricingSalaryMonthly','pricingProductiveHoursMonthly','pricingHourlyRate','laborRate','pricingSeasonalLaborPctV1802','pricingElectricityHourlyV1802','pricingFixedCosts')),
   'recipes',snapshot.data->'productRecipes','stock',(SELECT jsonb_agg(jsonb_build_object('name',x->'name','unitCost',x->'unitCost')) FROM jsonb_array_elements(snapshot.data->'stock')x)) INTO payload;
 WHEN 'producao' THEN
  IF jsonb_typeof(snapshot.data->'stock') IS DISTINCT FROM 'array' OR jsonb_typeof(snapshot.data->'productionRuns') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SOURCE_INCOMPLETE'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('data',jsonb_build_object('name',p.data->'name','code',p.data->'code','manufactured',p.data->'manufactured'))),'[]') INTO products FROM public.artessencia_v1_products p WHERE p.user_id=actor;
  FOR sale IN SELECT * FROM public.artessencia_v1_orders o WHERE o.user_id=actor AND o.status IN('Confirmada','Confirmado','Em produção','Produção') LOOP
   valid:=true;
   BEGIN
    materials:=artessencia_intelligence_private.team_order_needs(sale,snapshot,products);
    SELECT coalesce(jsonb_agg(jsonb_build_object('name',n.key,'qty',n.value,'unit',(SELECT x->>'unit' FROM jsonb_array_elements(snapshot.data->'stock')x WHERE x->>'name'=n.key LIMIT 1))),'[]') INTO needs FROM jsonb_each(materials)n;
   EXCEPTION WHEN raise_exception OR invalid_text_representation OR invalid_parameter_value THEN valid:=false;needs:='[]'; END;
   orders:=orders||jsonb_build_array(jsonb_build_object('id',sale.id,'status',sale.status,'complete',valid,'needs',needs,'delivery',sale.data->>'delivery',
    'alreadyProduced',EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot.data->'productionRuns')r WHERE r->'orders' ? (sale.data->>'id'))));
  END LOOP;
  payload:=jsonb_build_object('today',work_day,'orders',orders,'stock',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x->'name','qty',x->'qty','unit',x->'unit')),'[]') FROM jsonb_array_elements(snapshot.data->'stock')x));
 ELSE RAISE EXCEPTION 'DEPARTMENT_SCOPE_DENIED';
 END CASE;
 IF octet_length(payload::text)+octet_length(facts::text)>500000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('verified',true,'owner',actor,'agent',agent,'kind',run->>'kind','missionId',p_id,'leaseId',p_lease,'sourceRevision',snapshot.revision,
 'evidenceIds',jsonb_build_array('consulta-'||p_lease::text),'facts',facts,'payload',payload);
END;
$context$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_department_context(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Source: sql/intelligence-worker-v1.sql
-- Instalação sujeita a autorização. O papel não tem LOGIN nem acesso às tabelas.

DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artessencia_intelligence_worker') THEN
  CREATE ROLE artessencia_intelligence_worker NOLOGIN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN GRANT artessencia_intelligence_worker TO authenticator; END IF;
END $role$;
ALTER TABLE artessencia_intelligence_private.team_runs ADD COLUMN IF NOT EXISTS tool_receipts jsonb NOT NULL DEFAULT '[]'::jsonb;
-- No row is installed by default. Only the isolated fixture/project administrator
-- may enable the simulation marker; neither worker nor owner console may modify it.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.simulation_release(
 user_id uuid PRIMARY KEY,enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE artessencia_intelligence_private.simulation_release ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.simulation_release FROM PUBLIC,anon,authenticated,artessencia_intelligence_worker;
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_worker_v1(p_action text,p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $worker$
<<channel_name>>
DECLARE
 actor uuid:=auth.uid();
 mission uuid:=(p_args->>'mission')::uuid;
 request uuid:=(p_args->>'request')::uuid;
 channel text:=p_args->>'channel';
 agent text;
 state jsonb;
 candidate record;
 completed jsonb;
 child jsonb;
 proposed jsonb;
 child_id uuid;
 child_kind text;
 child_agent text;
 receipts jsonb:='[]';
 created_task jsonb;
 interrupted record;
 recovered integer:=0;
 permissions artessencia_intelligence_private.team_controls%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' OR octet_length(p_args::text)>110000 THEN RAISE EXCEPTION 'INVALID_ARGUMENTS'; END IF;
 IF p_action='simulation_identity' THEN
  RETURN to_jsonb(EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release s WHERE s.user_id=actor AND s.enabled));
 ELSIF p_action='identity' THEN RETURN to_jsonb(actor);
 ELSIF p_action='tick' THEN
  PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
  UPDATE artessencia_intelligence_private.team_inputs SET content=NULL WHERE user_id=actor AND expires_at<=clock_timestamp() AND content IS NOT NULL;
  FOR interrupted IN SELECT r.*,e.status AS charge_status FROM artessencia_intelligence_private.team_runs r
   LEFT JOIN artessencia_intelligence_private.ai_budget_entries e ON e.request_id=r.request_id
   WHERE r.user_id=actor AND r.status='working' AND r.started_at<clock_timestamp()-interval '10 minutes' ORDER BY r.started_at LIMIT 20 LOOP
   IF interrupted.charge_status='inflight' THEN PERFORM artessencia_intelligence_private.ai_budget_unknown(interrupted.request_id);
   ELSIF interrupted.charge_status='reserved' THEN PERFORM artessencia_intelligence_private.ai_budget_settle(interrupted.request_id,0,'unclaimed-'||interrupted.request_id,true);
   END IF;
   PERFORM artessencia_intelligence_private.team_finish_run(interrupted.mission_id,interrupted.lease_id,'blocked',jsonb_build_object('stage','recovery','receipts','[]'::jsonb));
   recovered:=recovered+1;
  END LOOP;
  RETURN jsonb_build_object('prepared',artessencia_intelligence_private.team_tick(),'recovered',recovered);
 ELSIF p_action='next' THEN
  SELECT m.mission_id,m.revision INTO candidate FROM artessencia_intelligence_private.team_missions m
   JOIN artessencia_intelligence_private.team_controls c USING(user_id)
   WHERE m.user_id=actor AND c.enabled AND c.modes->>m.agent<>'off' AND m.control_revision=c.revision AND m.status='approved'
    AND (p_args->'scheduled' IS DISTINCT FROM 'true'::jsonb OR c.modes->>m.agent IN ('semi','auto'))
    AND (m.kind IN ('daily_priority_plan','inventory_audit','stock_organization_plan','commercial_review','catalog_review','marketing_plan','innovation_review','technical_review','finance_review','production_plan'))
   ORDER BY m.created_at,m.mission_id LIMIT 1;
  RETURN jsonb_build_object('owner',actor,'missionId',candidate.mission_id,'revision',candidate.revision,'scheduledOnly',p_args->'scheduled' IS NOT DISTINCT FROM 'true'::jsonb);
 ELSIF p_action='claim_run' THEN
  IF p_args->'scheduled' IS NOT DISTINCT FROM 'true'::jsonb THEN
   SELECT * INTO permissions FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
   IF NOT FOUND OR NOT permissions.enabled OR NOT EXISTS(
    SELECT 1 FROM artessencia_intelligence_private.team_missions m WHERE m.user_id=actor AND m.mission_id=mission
     AND m.control_revision=permissions.revision AND permissions.modes->>m.agent IN ('semi','auto')
   ) THEN RAISE EXCEPTION 'SCHEDULE_MODE_DENIED'; END IF;
  END IF;
  RETURN artessencia_intelligence_private.team_claim_run(mission,(p_args->>'revision')::bigint);
 ELSIF p_action='status' THEN
  RETURN artessencia_intelligence_private.team_run_status(mission);
 ELSIF p_action='finish' THEN
  IF jsonb_array_length(p_args#>'{outcome,receipts}')<>0 THEN RAISE EXCEPTION 'UNVERIFIED_RECEIPTS'; END IF;
  SELECT * INTO permissions FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
  state:=artessencia_intelligence_private.team_run_status(mission);
  completed:=artessencia_intelligence_private.team_finish_run(mission,(p_args->>'lease')::uuid,p_args->>'status',p_args->'outcome');
  UPDATE artessencia_intelligence_private.team_inputs SET content=NULL WHERE user_id=actor AND mission_id=mission AND content IS NOT NULL;
  IF completed->>'status'<>'review_ready' OR completed->>'replayed'='true' THEN RETURN completed; END IF;
  IF jsonb_typeof(p_args#>'{outcome,delegations}') IS DISTINCT FROM 'array' OR jsonb_array_length(p_args#>'{outcome,delegations}')>8 THEN RAISE EXCEPTION 'INVALID_DELEGATIONS'; END IF;
  FOR child IN SELECT value FROM jsonb_array_elements(p_args#>'{outcome,delegations}') LOOP
   child_agent:=child->>'agent';
   IF state->>'agent'<>'director' OR child_agent='director' OR NOT permissions.modes ? child_agent THEN RAISE EXCEPTION 'DELEGATION_DENIED'; END IF;
   IF permissions.modes->>child_agent='off' OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_delegations d WHERE d.user_id=actor AND d.parent_id=mission AND d.department=child_agent) THEN CONTINUE; END IF;
   child_kind:=CASE child_agent WHEN 'stock' THEN 'inventory_audit' WHEN 'producao' THEN 'production_plan' WHEN 'financeiro' THEN 'finance_review'
    WHEN 'comercial' THEN 'commercial_review' WHEN 'marketing' THEN 'marketing_plan' WHEN 'inovacao' THEN 'innovation_review' WHEN 'catalogo' THEN 'catalog_review' WHEN 'auditoria' THEN 'technical_review' END;
   child_id:=gen_random_uuid();
   PERFORM artessencia_intelligence_private.team_create_mission(child_id,child_agent,child_kind,child->>'instruction',permissions.revision);
   INSERT INTO artessencia_intelligence_private.team_delegations VALUES(actor,mission,child_id,child_agent);
   IF permissions.modes->>child_agent='auto' THEN PERFORM artessencia_intelligence_private.team_transition(child_id,0,'approved',NULL); END IF;
   receipts:=receipts||jsonb_build_array(jsonb_build_object('tool','delegate','id',child_id,'agent',child_agent));
  END LOOP;
  IF permissions.modes->>(state->>'agent')='auto' THEN
   FOR proposed IN SELECT value FROM jsonb_array_elements(p_args#>'{outcome,report,tasks}') t
    WHERE t->>'agent'=state->>'agent' AND t->>'requiresApproval'='true' LIMIT 6 LOOP
    created_task:=public.artessencia_intelligence_console_v1('plan_task',jsonb_build_object('mission',mission,'key',proposed->>'key'));
    receipts:=receipts||jsonb_build_array(created_task||jsonb_build_object('tool','create_task'));
   END LOOP;
  END IF;
  UPDATE artessencia_intelligence_private.team_runs SET tool_receipts=receipts WHERE user_id=actor AND mission_id=mission;
  RETURN completed||jsonb_build_object('toolReceipts',receipts);
 ELSIF p_action='input' THEN
  state:=artessencia_intelligence_private.team_run_status(mission);
  IF (state->>'active')::boolean IS DISTINCT FROM true OR state->>'agent'<>'stock' OR (state->>'leaseId')::uuid IS DISTINCT FROM (p_args->>'lease')::uuid THEN RAISE EXCEPTION 'ATTACHMENT_SCOPE_DENIED'; END IF;
  SELECT jsonb_build_object('mime',mime,'content',content,'expired',expires_at<=clock_timestamp()) INTO child FROM artessencia_intelligence_private.team_inputs WHERE user_id=actor AND mission_id=mission;
  IF child IS NOT NULL AND (child->>'expired'='true' OR child->>'content' IS NULL) THEN RAISE EXCEPTION 'ATTACHMENT_EXPIRED'; END IF;
  RETURN coalesce(child,'{}');
 ELSIF p_action='stock' THEN
  RETURN artessencia_intelligence_private.team_stock_context(mission,(p_args->>'lease')::uuid);
 ELSIF p_action='director' THEN
  RETURN artessencia_intelligence_private.team_director_context(mission,(p_args->>'lease')::uuid);
 ELSIF p_action='department' THEN
  RETURN artessencia_intelligence_private.team_department_context(mission,(p_args->>'lease')::uuid);
 ELSIF p_action IN ('reserve','claim_charge','permission') THEN
  SELECT * INTO permissions FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
  IF NOT FOUND OR NOT permissions.enabled THEN RAISE EXCEPTION 'TEAM_DISABLED'; END IF;
  agent:=CASE channel WHEN 'legacy_insights' THEN 'marketing' WHEN 'legacy_social' THEN 'marketing' WHEN 'legacy_description' THEN 'catalogo' ELSE channel END;
  IF coalesce(permissions.modes->>agent,'off')='off' THEN RAISE EXCEPTION 'AGENT_DISABLED'; END IF;
  IF mission IS NOT NULL OR channel NOT IN ('legacy_insights','legacy_social','legacy_description') THEN
   state:=artessencia_intelligence_private.team_run_status(mission);
   IF (state->>'active')::boolean IS DISTINCT FROM true OR state->>'agent' IS DISTINCT FROM agent OR (state->>'requestId')::uuid IS DISTINCT FROM request THEN RAISE EXCEPTION 'MISSION_STALE'; END IF;
  END IF;
  IF p_action='permission' THEN RETURN 'true'::jsonb; END IF;
  IF p_action='reserve' THEN
   IF p_args->>'model'='artessencia-simulation-v1' AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release s WHERE s.user_id=actor AND s.enabled) THEN RAISE EXCEPTION 'SIMULATION_DISABLED'; END IF;
   IF p_args->>'model'<>'artessencia-simulation-v1' AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.simulation_release s WHERE s.user_id=actor AND s.enabled) THEN RAISE EXCEPTION 'REAL_MODEL_DISABLED_IN_SIMULATION'; END IF;
   RETURN artessencia_intelligence_private.ai_budget_reserve(request,channel,p_args->>'model',(p_args->>'maximum')::bigint);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries e WHERE e.request_id=request AND e.channel=channel_name.channel) THEN RAISE EXCEPTION 'WRONG_CHANNEL'; END IF;
  RETURN artessencia_intelligence_private.ai_budget_claim(request);
 ELSIF p_action='unknown' THEN
  PERFORM artessencia_intelligence_private.ai_budget_unknown(request); RETURN 'true'::jsonb;
 ELSIF p_action='settle' THEN
  RETURN artessencia_intelligence_private.ai_budget_settle(request,(p_args->>'actual')::bigint,p_args->>'evidence',false);
 END IF;
 RAISE EXCEPTION 'UNKNOWN_COMMAND';
END;
$worker$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_worker_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_worker_v1(text,jsonb) TO artessencia_intelligence_worker;

-- Source: sql/intelligence-audit-retry-v1.sql
-- Candidate: isolated only, after owner console and worker SQL. Do not apply in production.
-- One explicit owner-requested requeue for a reconciled, read-only audit reasoning failure.
-- No change to financial gates, provider calls, existing approvals, or worker permissions.

CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_run_retry_archive(
 user_id uuid NOT NULL, mission_id uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE REFERENCES artessencia_intelligence_private.ai_budget_entries(request_id),
 lease_id uuid NOT NULL UNIQUE, blocked_revision bigint NOT NULL,
 run_snapshot jsonb NOT NULL, mission_snapshot jsonb NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,mission_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.team_run_retry_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.team_run_retry_archive FROM PUBLIC,anon,authenticated;
-- Narrow owner-only entrypoint; not part of the service worker action allowlist.
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_requeue_audit_v1(p_id uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $retry$
DECLARE actor uuid:=auth.uid();
 c artessencia_intelligence_private.team_controls%rowtype;
 m artessencia_intelligence_private.team_missions%rowtype;
 r artessencia_intelligence_private.team_runs%rowtype;
 e artessencia_intelligence_private.ai_budget_entries%rowtype;
 bc artessencia_intelligence_private.ai_budget_control%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED';
 END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled OR c.modes->>'auditoria' IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'RETRY_MANUAL_ONLY'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR m.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'MISSION_REVISION_CONFLICT'; END IF;
 IF m.status<>'blocked' OR m.agent<>'auditoria' OR m.kind<>'technical_review' OR m.control_revision<>c.revision THEN RAISE EXCEPTION 'RETRY_SCOPE_DENIED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_run_retry_archive a WHERE a.user_id=actor AND a.mission_id=p_id) THEN RAISE EXCEPTION 'RETRY_ALREADY_USED'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'blocked' OR r.ended_at IS NULL OR r.claimed_revision+1<>m.revision
  OR r.outcome->>'stage' IS DISTINCT FROM 'reasoning'
  OR r.outcome->'receipts' IS DISTINCT FROM '[]'::jsonb
  OR r.tool_receipts IS DISTINCT FROM '[]'::jsonb
  OR r.outcome ? 'report' THEN RAISE EXCEPTION 'RETRY_SIDE_EFFECT_UNVERIFIED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_inputs i WHERE i.user_id=actor AND i.mission_id=p_id)
  OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_delegations d WHERE d.user_id=actor AND d.parent_id=p_id) THEN RAISE EXCEPTION 'RETRY_SIDE_EFFECT_UNVERIFIED'; END IF;
 SELECT * INTO bc FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR bc.frozen OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status IN ('reserved','inflight','unknown')) THEN RAISE EXCEPTION 'RETRY_BUDGET_UNRECONCILED'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=r.request_id FOR UPDATE;
 IF NOT FOUND OR e.status<>'settled' OR e.channel<>m.agent OR e.actual_microeur IS NULL
  OR jsonb_typeof(r.outcome->'chargedMicroeur') IS DISTINCT FROM 'number'
  OR r.outcome->'chargedMicroeur' IS DISTINCT FROM to_jsonb(e.actual_microeur)
  OR nullif(trim(e.evidence_ref),'') IS NULL THEN RAISE EXCEPTION 'RETRY_RECEIPT_UNVERIFIED'; END IF;
 -- Archive the exact prior attempt and mission state before moving the active slot.
 -- All writes are atomic, and the financial receipt itself is never modified.
 INSERT INTO artessencia_intelligence_private.team_run_retry_archive(user_id,mission_id,request_id,lease_id,blocked_revision,run_snapshot,mission_snapshot)
 VALUES(actor,p_id,r.request_id,r.lease_id,m.revision,to_jsonb(r),to_jsonb(m));
 DELETE FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id AND lease_id=r.lease_id;
 UPDATE artessencia_intelligence_private.team_missions SET status='pending_review',revision=m.revision+1,result_summary=NULL,updated_at=clock_timestamp()
 WHERE user_id=actor AND mission_id=p_id RETURNING * INTO m;
 INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,m.revision,'pending_review');
 RETURN jsonb_build_object('missionId',p_id,'revision',m.revision,'status',m.status,'previousRequestId',r.request_id,'requiresNewApproval',true);
END;
$retry$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_requeue_audit_v1(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_requeue_audit_v1(uuid,bigint) TO authenticated;
-- Read-only capability and archived receipt summaries. Never expose raw outcomes or credentials.
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_audit_retry_status_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $retry_status$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED';
 END IF;
 RETURN jsonb_build_object(
  'eligible', (SELECT coalesce(jsonb_agg(jsonb_build_object('missionId',z.mission_id,'revision',z.revision)),'[]')
   FROM (SELECT m.mission_id,m.revision FROM artessencia_intelligence_private.team_missions m
   JOIN artessencia_intelligence_private.team_controls c USING(user_id)
   JOIN artessencia_intelligence_private.team_runs r USING(user_id,mission_id)
   JOIN artessencia_intelligence_private.ai_budget_entries e USING(request_id)
   WHERE m.user_id=actor AND m.status='blocked' AND m.agent='auditoria' AND m.kind='technical_review'
   AND c.enabled AND c.modes->>'auditoria'='manual' AND c.revision=m.control_revision
   AND r.status='blocked' AND r.ended_at IS NOT NULL AND r.claimed_revision+1=m.revision
   AND r.outcome->>'stage'='reasoning' AND r.outcome->'receipts'='[]'::jsonb AND r.tool_receipts='[]'::jsonb
   AND NOT (r.outcome ? 'report') AND e.status='settled' AND e.channel=m.agent AND e.actual_microeur IS NOT NULL
   AND jsonb_typeof(r.outcome->'chargedMicroeur')='number' AND r.outcome->'chargedMicroeur'=to_jsonb(e.actual_microeur)
   AND nullif(trim(e.evidence_ref),'') IS NOT NULL
   AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_control bc WHERE bc.singleton AND NOT bc.frozen)
   AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status IN ('reserved','inflight','unknown'))
   AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_run_retry_archive a WHERE a.user_id=actor AND a.mission_id=m.mission_id)
   AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_inputs i WHERE i.user_id=actor AND i.mission_id=m.mission_id)
   AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_delegations d WHERE d.user_id=actor AND d.parent_id=m.mission_id)
   ORDER BY m.updated_at DESC,m.mission_id LIMIT 100) z),
  'history',(SELECT coalesce(jsonb_agg(jsonb_build_object('missionId',z.mission_id,'blockedRevision',z.blocked_revision,
    'chargedMicroeur',z.actual_microeur,'archivedAt',z.archived_at)),'[]')
    FROM (SELECT a.mission_id,a.blocked_revision,e.actual_microeur,a.archived_at
    FROM artessencia_intelligence_private.team_run_retry_archive a JOIN artessencia_intelligence_private.ai_budget_entries e USING(request_id)
    WHERE a.user_id=actor ORDER BY a.archived_at DESC,a.mission_id LIMIT 100)z));
END;
$retry_status$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_audit_retry_status_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_audit_retry_status_v1() TO authenticated;

-- Source: sql/intelligence-hosted-service-v1.sql
-- Production candidate only. No account, binding, permission or paid release
-- is enabled by this migration. Do not apply over the isolated trial bridge.

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

UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=false,frozen=true,monthly_limit_microeur=0 WHERE singleton;
INSERT INTO artessencia_intelligence_private.team_controls(user_id) SELECT user_id FROM public.store_owner WHERE active;
DO $postflight$ BEGIN
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_controls WHERE enabled OR EXISTS(SELECT 1 FROM jsonb_each_text(modes) v WHERE v.value<>'off')) THEN RAISE EXCEPTION 'TEAM_ENABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.worker_service_binding) OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_routines) THEN RAISE EXCEPTION 'EXECUTION_CONFIGURED'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
