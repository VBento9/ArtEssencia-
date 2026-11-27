-- Instalar apenas após validação das dependências team, run e ai-budget.
BEGIN;
ALTER TABLE artessencia_intelligence_private.team_runs ADD COLUMN IF NOT EXISTS tool_receipts jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_inputs(
 user_id uuid NOT NULL,mission_id uuid NOT NULL,mime text NOT NULL,content text,expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id),FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.team_inputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artessencia_intelligence_private.team_inputs FROM PUBLIC,anon,authenticated;
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
   'unknown',count(*) FILTER(WHERE status='unknown')) INTO expenses FROM artessencia_intelligence_private.ai_budget_entries;
  expenses:=expenses||jsonb_build_object('channels',(SELECT coalesce(jsonb_object_agg(channel,jsonb_build_object('settled',settled,'pending',pending)),'{}') FROM
   (SELECT channel,coalesce(sum(actual_microeur) FILTER(WHERE status='settled' AND date_trunc('month',now() AT TIME ZONE 'Europe/Lisbon')::date IN(reserved_month,settled_month)),0) settled,
    coalesce(sum(maximum_microeur) FILTER(WHERE status IN ('reserved','unknown','inflight')),0) pending FROM artessencia_intelligence_private.ai_budget_entries GROUP BY channel)t));
  RETURN jsonb_build_object('routines',(SELECT coalesce(jsonb_agg(jsonb_build_object('agent',r.agent,'cadence',r.cadence,'enabled',r.enabled,'instruction',r.instruction)),'[]') FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=actor),
   'documents',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM (SELECT r.mission_id,m.agent,r.outcome->>'reasoning' AS content,r.outcome->'report'->'tasks' AS tasks,r.tool_receipts FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id) WHERE r.user_id=actor AND r.status='review_ready' ORDER BY r.ended_at DESC LIMIT 50)d),
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
COMMIT;
