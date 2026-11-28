-- Read-only director business context. No grants, controls or paid release are changed.
BEGIN;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_director_context(p_id uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $director$
DECLARE
 actor uuid:=auth.uid();
 run jsonb;
 reports jsonb;
 keys jsonb;
 snapshot public.artessencia_v1_state%rowtype;
 facts jsonb;
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
 WHERE user_id=actor AND entity='operational_tasks_v1' AND deleted_at IS NULL AND data->>'source'='intelligence' AND data ? 'intelligence_semantic_key';
 SELECT * INTO snapshot FROM public.artessencia_v1_state WHERE user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTOR_SOURCE_UNAVAILABLE'; END IF;
 -- Bounded owner-scoped aggregates only. No customer names, contacts, raw
 -- instructions, prices, balances or credentials are returned here.
 facts:=jsonb_build_object(
  'capturedAt',clock_timestamp(),'stateUpdatedAt',snapshot.updated_at,'stateRevision',snapshot.revision,
  'products',jsonb_build_object('registered',(SELECT count(*) FROM public.artessencia_v1_products WHERE user_id=actor)),
  'orders',jsonb_build_object('registered',(SELECT count(*) FROM public.artessencia_v1_orders WHERE user_id=actor),
   'byStatus',(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM
    (SELECT status,count(*) AS count FROM
     (SELECT CASE WHEN status IN ('Confirmada','Confirmado','Em produção','Produção','Pendente','Paga','Pago','Pronta','Pronto','Concluída','Concluído','Cancelada','Cancelado','Entregue','Rascunho','Por confirmar','Feita','Feito') THEN status ELSE 'não classificado' END AS status
      FROM public.artessencia_v1_orders WHERE user_id=actor) scoped
     GROUP BY status ORDER BY count(*) DESC,status LIMIT 30)q)),
  'quotes',jsonb_build_object('registered',(SELECT count(*) FROM public.artessencia_v1_quotes WHERE user_id=actor)),
  'materials',jsonb_build_object('registered',CASE WHEN jsonb_typeof(snapshot.data->'stock')='array' THEN jsonb_array_length(snapshot.data->'stock') END,'physicalCountVerified',false),
  'recipes',jsonb_build_object('registered',CASE WHEN jsonb_typeof(snapshot.data->'productRecipes')='object' THEN (SELECT count(*) FROM jsonb_object_keys(snapshot.data->'productRecipes')) END),
  'planning',jsonb_build_object('registered',(SELECT count(*) FROM public.artessencia_cloud_records WHERE user_id=actor AND entity='operational_tasks_v1' AND deleted_at IS NULL),
   'explicitlyPending',(SELECT count(*) FROM public.artessencia_cloud_records WHERE user_id=actor AND entity='operational_tasks_v1' AND deleted_at IS NULL AND data->>'status'='pendente'),
   'highPriorityPending',(SELECT count(*) FROM public.artessencia_cloud_records WHERE user_id=actor AND entity='operational_tasks_v1' AND deleted_at IS NULL AND data->>'status'='pendente' AND data->>'priority'='alta')),
  'team',jsonb_build_object('approved',(SELECT count(*) FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND status='approved'),
   'working',(SELECT count(*) FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND status='working'),
   'blocked',(SELECT count(*) FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND status='blocked')),
  'reusedReports',(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM
   (SELECT m.agent,r.mission_id AS "missionId",r.ended_at AS "completedAt" FROM artessencia_intelligence_private.team_runs r
    JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id)
    WHERE r.user_id=actor AND r.status='review_ready' AND m.agent<>'director' AND r.outcome->'report'->>'mode'='proposal_only'
    ORDER BY r.ended_at DESC LIMIT 50)q),
  'coverage','Contagens dos registos do titular na Cloud nesta consulta; não demonstram atividade recente, vendas, lucro, pagamentos, saldos físicos, capacidade ou cumprimento de prazos. Estados de encomendas reconhecidos agrupados sem interpretação financeira; outros estados são não classificados e os respetivos textos não são expostos. Até 30 estados; podem existir outros. O Planeamento só classifica explicitamente pendente/alta. Sem títulos ou pesquisa semântica, não é possível excluir duplicações de trabalho manual. Relatórios de departamentos são reutilizados, com data em reusedReports: não representam novas intervenções. Ausência de propostas de departamentos não comprova ausência de problemas. Estado da Loja e sincronização de dispositivos não verificados.');
 IF octet_length(reports::text)+octet_length(keys::text)+octet_length(facts::text)>500000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('verified',true,'owner',actor,'agent','director','kind','daily_priority_plan','missionId',p_id,'leaseId',p_lease,'sourceRevision',snapshot.revision,
 'evidenceIds',jsonb_build_array('mission-'||p_id,'canonical-state-r'||snapshot.revision::text),'facts',facts,'payload',jsonb_build_object('today',(clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date,'reports',reports,'existingTaskKeys',keys,'limit',30));
END;
$director$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_director_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
