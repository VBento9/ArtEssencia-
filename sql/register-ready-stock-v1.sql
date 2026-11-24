-- All stock writers lock the owner's operational row before reading this balance.
CREATE OR REPLACE FUNCTION public.artessencia_ready_balance_v1(state_data jsonb, product_code text)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 WITH lots AS (
   SELECT sum((line->>'qty')::numeric * CASE WHEN run->>'mode' IN ('loss','damage','correct_down') THEN -1 ELSE 1 END) AS units
   FROM jsonb_array_elements(coalesce(state_data->'productionRuns','[]')) run
   CROSS JOIN LATERAL jsonb_array_elements(coalesce(run->'products','[]')) line
   WHERE run->>'kind'='ready_stock' AND line->>'code'=product_code
 ), sales AS (
   SELECT coalesce(sum((line->>'qty')::numeric),0) AS units
   FROM public.artessencia_v1_orders o
   CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.data->'items','[]')) line
   WHERE o.user_id=auth.uid() AND o.data->>'source'='direct_sale' AND line->>'code'=product_code
     AND line->'readyStockTracked'='true'::jsonb
     AND (coalesce(o.data->>'voidedAt','')='' OR o.data->'readyRestocked' IS DISTINCT FROM 'true'::jsonb)
 )
 SELECT lots.units-sales.units FROM lots,sales;
$$;
REVOKE ALL ON FUNCTION public.artessencia_ready_balance_v1(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artessencia_ready_balance_v1(jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.artessencia_register_ready_stock_v1(p_revision bigint,p_run jsonb,p_product jsonb,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $function$
DECLARE
 actor uuid:=auth.uid(); s public.artessencia_v1_state%rowtype; p public.artessencia_v1_products%rowtype;
 previous jsonb; recipe jsonb; ingredient jsonb; item record; stock jsonb; moves jsonb; run jsonb;
 code text; mode text; name text; n numeric; amount numeric; available numeric; hits integer; needs jsonb:='{}';
 stamp timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF jsonb_typeof(p_run) IS DISTINCT FROM 'object' OR coalesce(p_run->>'id','')='' OR p_run->>'kind' IS DISTINCT FROM 'ready_stock'
 OR jsonb_typeof(p_run->'products') IS DISTINCT FROM 'array' OR jsonb_array_length(p_run->'products')<>1
 OR jsonb_typeof(p_run->'materials') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_READY_REQUEST'; END IF;
 mode:=p_run->>'mode'; code:=p_run#>>'{products,0,code}'; n:=(p_run#>>'{products,0,qty}')::numeric;
 IF mode IS NULL OR mode NOT IN ('consume','already','correct_up','correct_down','loss','damage') OR coalesce(code,'')='' OR n IS NULL OR n='NaN'::numeric OR n<1 OR n>100000 OR n<>trunc(n) THEN RAISE EXCEPTION 'INVALID_READY_QUANTITY'; END IF;
 IF coalesce(p_run->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (p_run->>'date')::date > (now() AT TIME ZONE 'Europe/Lisbon')::date THEN RAISE EXCEPTION 'INVALID_MOVEMENT_DATE'; END IF;
 IF mode NOT IN ('consume','already') AND length(trim(coalesce(p_run->>'reason',''))) NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'ADJUSTMENT_REASON_REQUIRED'; END IF;
 SELECT * INTO s FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 SELECT x INTO previous FROM jsonb_array_elements(coalesce(s.data->'productionRuns','[]')) x WHERE x->>'id'=p_run->>'id';
 IF previous IS NOT NULL THEN
   IF previous->>'kind' IS DISTINCT FROM 'ready_stock' OR previous->>'mode' IS DISTINCT FROM mode OR previous->>'date' IS DISTINCT FROM p_run->>'date' OR coalesce(previous->>'reason','') IS DISTINCT FROM coalesce(p_run->>'reason','') OR coalesce(previous->'requestedMaterials',previous->'materials') IS DISTINCT FROM p_run->'materials' OR previous#>>'{products,0,code}' IS DISTINCT FROM code OR (previous#>>'{products,0,qty}')::numeric IS DISTINCT FROM n THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('state',to_jsonb(s),'orders','[]'::jsonb,'replayed',true);
 END IF;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
 SELECT * INTO p FROM public.artessencia_v1_products WHERE user_id=actor AND id=(p_product->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR p.data IS DISTINCT FROM p_product->'data' OR p.updated_at IS DISTINCT FROM (p_product->>'updated_at')::timestamptz OR p.data->>'code' IS DISTINCT FROM code THEN RAISE EXCEPTION 'PRODUCT_CHANGED'; END IF;
 IF p.data->'active'='false'::jsonb OR p.data->'archivedV1803'='true'::jsonb THEN RAISE EXCEPTION 'PRODUCT_INACTIVE'; END IF;
 IF mode IN ('correct_down','loss','damage') AND coalesce(public.artessencia_ready_balance_v1(s.data,code),0)<n THEN RAISE EXCEPTION 'INSUFFICIENT_READY_STOCK'; END IF;
 IF mode='consume' THEN
   IF p.data->'manufactured'='false'::jsonb THEN RAISE EXCEPTION 'PRODUCT_NOT_MANUFACTURED'; END IF;
   recipe:=s.data->'productRecipes'->code;
   IF jsonb_typeof(recipe) IS DISTINCT FROM 'array' OR jsonb_array_length(recipe)=0 THEN RAISE EXCEPTION 'RECIPE_REQUIRED'; END IF;
   FOR ingredient IN SELECT value FROM jsonb_array_elements(recipe) LOOP
     name:=ingredient->>'item'; amount:=(ingredient->>'qty')::numeric;
     IF coalesce(name,'')='' OR amount IS NULL OR amount='NaN'::numeric OR amount<=0 THEN RAISE EXCEPTION 'INVALID_RECIPE'; END IF;
     needs:=jsonb_set(needs,ARRAY[name],to_jsonb(coalesce((needs->>name)::numeric,0)+amount*n));
   END LOOP;
 END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(needs))<>(SELECT count(*) FROM jsonb_object_keys(p_run->'materials')) OR EXISTS(SELECT 1 FROM jsonb_each(needs) m WHERE jsonb_typeof(p_run->'materials'->m.key) IS DISTINCT FROM 'number' OR abs((p_run->'materials'->>m.key)::numeric-m.value::text::numeric)>0.00000001) THEN RAISE EXCEPTION 'MATERIAL_CONTRACT_MISMATCH'; END IF;
 stock:=s.data->'stock';moves:=coalesce(s.data->'stockMoves','[]');
 IF jsonb_typeof(stock) IS DISTINCT FROM 'array' OR jsonb_typeof(moves) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STOCK'; END IF;
 FOR item IN SELECT key,value FROM jsonb_each(needs) LOOP
   amount:=item.value::text::numeric;
   SELECT count(*),min((x->>'qty')::numeric) INTO hits,available FROM jsonb_array_elements(stock) x WHERE x->>'name'=item.key;
   IF hits<>1 OR available IS NULL OR available='NaN'::numeric OR available<amount THEN RAISE EXCEPTION 'INSUFFICIENT_OR_AMBIGUOUS_STOCK'; END IF;
   SELECT jsonb_agg(CASE WHEN x->>'name'=item.key THEN jsonb_set(x,'{qty}',to_jsonb(available-amount)) ELSE x END ORDER BY pos) INTO stock FROM jsonb_array_elements(stock) WITH ORDINALITY t(x,pos);
   moves:=moves||jsonb_build_array(jsonb_build_object('date',stamp,'item',item.key,'type','production','qty',amount,'beforeQty',available,'afterQty',available-amount,'productionRunId',p_run->>'id','orderIds','[]'::jsonb,'note','Produção para stock'));
 END LOOP;
 run:=p_run||jsonb_build_object('createdAt',stamp,'requestedMaterials',p_run->'materials','orders','[]'::jsonb,'orderMaterials','{}'::jsonb,'orderProducts','{}'::jsonb,'materials',needs,'total',n,'products',jsonb_build_array(jsonb_build_object('code',code,'name',p.data->>'name','qty',n)));
 PERFORM set_config('artessencia.ready_writer','stock',true);
 UPDATE public.artessencia_v1_state SET data=jsonb_set(jsonb_set(jsonb_set(s.data,'{stock}',stock),'{stockMoves}',moves),'{productionRuns}',coalesce(s.data->'productionRuns','[]')||jsonb_build_array(run)),revision=s.revision+1,updated_at=stamp,device_id=p_device,app_version='1.9.191' WHERE user_id=actor RETURNING * INTO s;
 PERFORM set_config('artessencia.ready_writer','',true);
 RETURN jsonb_build_object('state',to_jsonb(s),'orders','[]'::jsonb,'replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.artessencia_register_ready_stock_v1(bigint,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artessencia_register_ready_stock_v1(bigint,jsonb,jsonb,text) TO authenticated;
