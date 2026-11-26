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
