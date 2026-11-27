-- Instalação sujeita a autorização. O papel não tem LOGIN nem acesso às tabelas.
BEGIN;
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artessencia_intelligence_worker') THEN
  CREATE ROLE artessencia_intelligence_worker NOLOGIN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN GRANT artessencia_intelligence_worker TO authenticator; END IF;
END $role$;
ALTER TABLE artessencia_intelligence_private.team_runs ADD COLUMN IF NOT EXISTS tool_receipts jsonb NOT NULL DEFAULT '[]'::jsonb;
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
 IF p_action='identity' THEN RETURN to_jsonb(actor);
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
    AND (m.kind IN ('daily_priority_plan','inventory_audit','stock_organization_plan','commercial_review','catalog_review','marketing_plan','innovation_review','technical_review','finance_review','production_plan'))
   ORDER BY m.created_at,m.mission_id LIMIT 1;
  RETURN jsonb_build_object('owner',actor,'missionId',candidate.mission_id,'revision',candidate.revision);
 ELSIF p_action='claim_run' THEN
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
  IF p_action='reserve' THEN RETURN artessencia_intelligence_private.ai_budget_reserve(request,channel,p_args->>'model',(p_args->>'maximum')::bigint); END IF;
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
COMMIT;
