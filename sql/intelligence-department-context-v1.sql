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
