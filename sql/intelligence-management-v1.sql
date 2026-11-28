-- Owner-only consolidation of completed reports. No provider or financial writes.
BEGIN;
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_management_v1(p_action text,p_args jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $management$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype;
 result jsonb; item jsonb; selected jsonb; receipt jsonb; receipts jsonb:='[]'::jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' OR octet_length(p_args::text)>24000 THEN RAISE EXCEPTION 'INVALID_ARGUMENTS'; END IF;
 IF p_action='plan' THEN
  IF p_args->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_args->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MANAGEMENT_APPROVAL_REQUIRED'; END IF;
  IF jsonb_array_length(p_args->'items') NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_SELECTION'; END IF;
  SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
  IF NOT FOUND OR NOT c.enabled OR c.modes->>'director'='off' OR c.revision IS DISTINCT FROM (p_args->>'revision')::bigint THEN RAISE EXCEPTION 'TEAM_REVISION_CONFLICT'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_args->'items') LOOP
   result:=public.artessencia_intelligence_management_v1('read','{}');
   SELECT v INTO selected FROM jsonb_array_elements(result->'candidates') v
   WHERE v->>'missionId'=item->>'missionId' AND v->>'key'=item->>'key';
   IF NOT FOUND THEN RAISE EXCEPTION 'MANAGEMENT_SELECTION_STALE'; END IF;
   receipt:=public.artessencia_intelligence_console_v1('plan_task',jsonb_build_object('mission',selected->>'missionId','key',selected->>'key'));
   IF receipt->>'status' IS DISTINCT FROM 'confirmed' THEN RAISE EXCEPTION 'MANAGEMENT_TASK_UNAVAILABLE'; END IF;
   receipts:=receipts||jsonb_build_array(receipt);
  END LOOP;
  RETURN jsonb_build_object('status','confirmed','receipts',receipts,'paid',false);
 ELSIF p_action IS DISTINCT FROM 'read' THEN RAISE EXCEPTION 'UNKNOWN_COMMAND'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_UNAVAILABLE'; END IF;
 WITH recent AS (
  SELECT m.mission_id,m.agent,r.ended_at,r.outcome->'report'->'tasks' tasks
  FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id)
  WHERE r.user_id=actor AND r.status='review_ready' AND m.status='review_ready' AND m.agent<>'director'
    AND jsonb_typeof(r.outcome->'report'->'tasks')='array'
  ORDER BY r.ended_at DESC NULLS LAST,m.mission_id LIMIT 50
 ), raw AS (
  SELECT r.mission_id,r.agent,r.ended_at,t->>'key' key,t->>'title' title,t->>'kind' kind,t->>'priority' priority,t->>'dueDate' due,
    lower(regexp_replace(btrim(t->>'title'),'[[:space:]]+',' ','g')) normalized,t->'requiresApproval' approval,t->>'agent' task_agent
  FROM recent r CROSS JOIN LATERAL jsonb_array_elements(r.tasks) t
 ), valid AS (
  SELECT * FROM raw WHERE task_agent=agent AND approval='true'::jsonb AND length(key) BETWEEN 1 AND 200
   AND length(btrim(title)) BETWEEN 1 AND 160 AND priority IN ('1','2','3')
   AND (due IS NULL OR due ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AND normalized<>''
 ), ranked AS (
  SELECT v.*,count(*) OVER(PARTITION BY agent,normalized) group_count,
   row_number() OVER(PARTITION BY agent,normalized ORDER BY priority,(kind IS NULL),due NULLS LAST,ended_at DESC NULLS LAST,mission_id,key) rank_no
  FROM valid v
 ), groups AS (
  SELECT r.*,
   EXISTS(SELECT 1 FROM valid v JOIN public.artessencia_cloud_records p ON p.user_id=actor AND p.entity='operational_tasks_v1'
     AND (p.data->>'intelligence_semantic_key'=v.key OR (p.deleted_at IS NULL AND p.data->>'status'='pendente'
      AND lower(regexp_replace(btrim(p.data->>'title'),'[[:space:]]+',' ','g'))=v.normalized))
     WHERE v.agent=r.agent AND v.normalized=r.normalized) existing
  FROM ranked r WHERE rank_no=1
 ), eligible AS (
  SELECT * FROM groups WHERE NOT existing AND c.enabled AND c.modes->>'director'<>'off' AND coalesce(c.modes->>agent,'off')<>'off'
 ), top_items AS (
  SELECT * FROM eligible ORDER BY priority,due NULLS LAST,agent,key LIMIT 30
 )
 SELECT jsonb_build_object('paid',false,'revision',c.revision,'reports',(SELECT count(*) FROM recent),
  'total',(SELECT count(*) FROM raw),'invalid',(SELECT count(*) FROM raw)-(SELECT count(*) FROM valid),
  'groups',(SELECT count(*) FROM groups),'sameTitleExtra',(SELECT coalesce(sum(group_count-1),0) FROM groups),
  'alreadyInPlanning',(SELECT count(*) FROM groups WHERE existing),'eligible',(SELECT count(*) FROM eligible),
  'byDepartment',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.agent),'[]') FROM
    (SELECT agent,count(*) AS "groups",sum(group_count) AS "original",count(*) FILTER(WHERE existing) AS "existing" FROM groups GROUP BY agent)d),
  'candidates',(SELECT coalesce(jsonb_agg(jsonb_build_object('missionId',mission_id,'agent',agent,'key',key,'title',title,'priority',priority::integer,'dueDate',due,'groupCount',group_count) ORDER BY priority,due NULLS LAST,agent,key),'[]') FROM top_items),
  'coverage','Até 50 relatórios recentes, máximo 30 prioridades por consulta. Agrupamento por departamento e título normalizado: não comprova equivalência semântica. Nenhuma tarefa sem aprovação explícita.')
 INTO result;
 RETURN result;
END;
$management$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_management_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_management_v1(text,jsonb) TO authenticated;
COMMIT;
