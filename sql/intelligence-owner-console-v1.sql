-- Instalar apenas após validação das dependências team, run e ai-budget.
BEGIN;
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
   'unknown',count(*) FILTER(WHERE status='unknown')) INTO expenses FROM artessencia_intelligence_private.ai_budget_entries;
  expenses:=expenses||jsonb_build_object('channels',(SELECT coalesce(jsonb_object_agg(channel,jsonb_build_object('settled',settled,'pending',pending)),'{}') FROM
   (SELECT channel,coalesce(sum(actual_microeur) FILTER(WHERE status='settled' AND date_trunc('month',now() AT TIME ZONE 'Europe/Lisbon')::date IN(reserved_month,settled_month)),0) settled,
    coalesce(sum(maximum_microeur) FILTER(WHERE status IN ('reserved','unknown','inflight')),0) pending FROM artessencia_intelligence_private.ai_budget_entries GROUP BY channel)t));
  RETURN jsonb_build_object('routines',(SELECT coalesce(jsonb_agg(jsonb_build_object('agent',r.agent,'cadence',r.cadence,'enabled',r.enabled,'instruction',r.instruction)),'[]') FROM artessencia_intelligence_private.team_routines r WHERE r.user_id=actor),
   'documents',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM (SELECT r.mission_id,m.agent,r.outcome->>'reasoning' AS content,r.outcome->'report'->'tasks' AS tasks,r.outcome->'report'->'physicalCount' AS physical_count,r.outcome->'report'->'referenceRepairs' AS reference_repairs,r.tool_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('index',z.line_index,'name',z.material->>'name','revision',z.committed_revision)),'[]') FROM artessencia_intelligence_private.material_creation_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS material_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('index',z.proposal_index,'revision',z.committed_revision)),'[]') FROM artessencia_intelligence_private.recipe_reference_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS reference_receipts,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',z.operation_id,'source',z.preview->>'source','target',z.preview->>'target','operation',z.preview->>'operation','revision',z.committed_revision,'revertedRevision',z.reverted_revision) ORDER BY z.created_at DESC),'[]') FROM artessencia_intelligence_private.stock_change_receipts z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS stock_change_receipts,
    r.outcome->'report'->'commercialProposals' AS commercial_proposals,
    (SELECT coalesce(jsonb_agg(z.proposal_index),'[]') FROM artessencia_intelligence_private.commercial_proposals z WHERE z.user_id=r.user_id AND z.mission_id=r.mission_id) AS commercial_receipts,r.outcome->'report'->'publicComparison' AS public_comparison FROM artessencia_intelligence_private.team_runs r JOIN artessencia_intelligence_private.team_missions m USING(user_id,mission_id) WHERE r.user_id=actor AND r.status='review_ready' ORDER BY r.ended_at DESC LIMIT 50)d),
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
