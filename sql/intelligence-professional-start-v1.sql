-- Start departmental planning only on explicit owner confirmation, without enabling paid execution.
-- Existing routine configuration and permissions are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_console_v1(p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 WHEN 'prepare_team_routines' THEN
  IF p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'ROUTINE_PREPARATION_APPROVAL_REQUIRED'; END IF;
  PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor AND revision=(p_args->>'revision')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_REVISION_CONFLICT'; END IF;
  -- Only create missing departments; never activate or replace an existing routine.
  WITH prepared AS (
   INSERT INTO artessencia_intelligence_private.team_routines(user_id,agent,cadence,kind,instruction,enabled)
   SELECT actor,x.agent,x.cadence,x.kind,x.instruction,false FROM (VALUES
   ('director','daily','daily_priority_plan','Rever prioridades, tarefas em aberto e bloqueios dos departamentos. Propor delegações internas sem duplicação.'),
   ('stock','daily','inventory_audit','Rever inventário e referências nas fichas técnicas. Identificar materiais em falta e duplicados sem alterar saldos.'),
   ('producao','daily','production_plan','Rever encomendas confirmadas e necessidades de materiais; sinalizar fichas incompletas e prazos por validar.'),
   ('financeiro','weekly','finance_review','Rever custos, margens, pagamentos pendentes e dados incompletos usando cálculos canónicos.'),
   ('comercial','daily','commercial_review','Rever pedidos e orçamentos abertos. Preparar seguimento interno sem contactar clientes.'),
   ('marketing','weekly','marketing_plan','Preparar calendário editorial de acordo com os produtos e ocasiões confirmados, sem publicar nem contratar publicidade.'),
   ('catalogo','weekly','catalog_review','Comparar produtos internos e serviço público; verificar referências de imagens, famílias e coleções e sinalizar estado da Loja.'),
   ('inovacao','monthly','innovation_review','Propor um conceito artesanal distintivo com materiais, custos e ensaios por validar.'),
   ('auditoria','weekly','technical_review','Rever inconsistências e recibos, distinguir testes concluídos de lacunas e propor correções prioritárias.')
   ) AS x(agent,cadence,kind,instruction)
   WHERE NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=actor AND r.agent=x.agent)
   ON CONFLICT(user_id,agent,cadence) DO NOTHING RETURNING agent
  )
  SELECT coalesce(jsonb_agg(agent ORDER BY agent),'[]'::jsonb) INTO task_record FROM prepared;
  RETURN jsonb_build_object('prepared',task_record,'activated',false);
 WHEN 'start_team_work' THEN
  IF p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'TEAM_START_APPROVAL_REQUIRED'; END IF;
  PERFORM 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor AND revision=(p_args->>'revision')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_REVISION_CONFLICT'; END IF;
  -- Preserve previous configuration; multiple routines require manual resolution.
  IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_routines WHERE user_id=actor GROUP BY agent HAVING count(*)>1) THEN RAISE EXCEPTION 'MULTIPLE_DEPARTMENT_ROUTINES'; END IF;
  PERFORM public.artessencia_intelligence_console_v1('prepare_team_routines',jsonb_build_object('revision',(p_args->>'revision')::bigint,'confirmed',true));
  -- Start only in semi mode: prepare pending-review missions, never approve paid work.
  IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_controls WHERE user_id=actor AND (NOT enabled OR modes IS DISTINCT FROM '{"director":"semi","stock":"semi","producao":"semi","financeiro":"semi","comercial":"semi","marketing":"semi","catalogo":"semi","inovacao":"semi","auditoria":"semi"}'::jsonb)) THEN
   PERFORM artessencia_intelligence_private.team_set_controls((p_args->>'revision')::bigint,true,'{"director":"semi","stock":"semi","producao":"semi","financeiro":"semi","comercial":"semi","marketing":"semi","catalogo":"semi","inovacao":"semi","auditoria":"semi"}'::jsonb);
  END IF;
  -- Mark current periods already covered by an open mission or a completed report.
  -- Never change an existing mission, report, payment reservation or business record.
  WITH periods AS (
   SELECT r.agent,r.cadence,r.kind,CASE r.cadence WHEN 'daily' THEN (statement_timestamp() AT TIME ZONE 'Europe/Lisbon')::date WHEN 'weekly' THEN date_trunc('week',statement_timestamp() AT TIME ZONE 'Europe/Lisbon')::date ELSE date_trunc('month',statement_timestamp() AT TIME ZONE 'Europe/Lisbon')::date END AS period_start
   FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=actor
  )
  UPDATE artessencia_intelligence_private.team_routines r SET last_period=greatest(r.last_period,p.period_start)
   FROM periods p WHERE r.user_id=actor AND r.agent=p.agent AND r.cadence=p.cadence
   AND EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_missions m WHERE m.user_id=actor AND m.agent=r.agent AND m.kind=r.kind
      AND (m.status IN ('pending_review','approved','working') OR (m.status='review_ready' AND (m.updated_at AT TIME ZONE 'Europe/Lisbon')::date>=p.period_start)));
  UPDATE artessencia_intelligence_private.team_routines SET enabled=true WHERE user_id=actor AND NOT enabled;
  RETURN jsonb_build_object('prepared',artessencia_intelligence_private.team_tick(),'mode','semi','paid',false);
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
$function$;
COMMIT;
