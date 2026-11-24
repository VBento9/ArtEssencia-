CREATE OR REPLACE FUNCTION public.artessencia_commit_ready_sale_v1(p_revision bigint,p_order jsonb,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 a uuid:=auth.uid(); s public.artessencia_v1_state%rowtype; o public.artessencia_v1_orders%rowtype;
 rid uuid; saleid text; line jsonb; pay jsonb; result_data jsonb; cash jsonb; movement jsonb;
 refund boolean; found_order boolean; code text; qty numeric; price numeric; total_amount numeric:=0;
 made numeric; sold numeric; tracked boolean; paymentid text; method text; day date;
 stamp timestamptz:=clock_timestamp();
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF jsonb_typeof(p_order) IS DISTINCT FROM 'object' OR p_order->>'source' IS DISTINCT FROM 'direct_sale'
 OR coalesce(p_order->>'id','') NOT LIKE 'VD-%' OR jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_order->'items')=0 OR jsonb_typeof(p_order->'paymentHistory') IS DISTINCT FROM 'array'
 OR coalesce(p_order->>'status','') NOT IN ('Entregue','Cancelado') THEN RAISE EXCEPTION 'INVALID_SALE'; END IF;
 rid:=(p_order->>'_rid')::uuid; saleid:=p_order->>'id'; refund:=p_order->>'status'='Cancelado';
 IF rid IS NULL THEN RAISE EXCEPTION 'INVALID_ID'; END IF;
 SELECT * INTO s FROM public.artessencia_v1_state WHERE user_id=a FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 SELECT * INTO o FROM public.artessencia_v1_orders WHERE user_id=a AND id=rid FOR UPDATE;
 found_order:=FOUND;
 IF found_order THEN
   IF o.data->>'source' IS DISTINCT FROM 'direct_sale' OR o.data->>'id' IS DISTINCT FROM saleid
   OR o.data->'items' IS DISTINCT FROM p_order->'items' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   IF (NOT refund AND o.data->'paymentHistory'->0=p_order->'paymentHistory'->0)
    OR (refund AND o.status='Cancelado' AND o.data->'paymentHistory'=p_order->'paymentHistory'
       AND o.data->'readyRestocked'=p_order->'readyRestocked') THEN
    RETURN jsonb_build_object('state',to_jsonb(s),'orders',jsonb_build_array(to_jsonb(o)),'replayed',true);
   END IF;
   IF NOT refund OR o.status IS DISTINCT FROM 'Entregue' THEN RAISE EXCEPTION 'SALE_ALREADY_RECORDED'; END IF;
 ELSE
   IF refund THEN RAISE EXCEPTION 'SALE_NOT_FOUND'; END IF;
 END IF;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
 IF NOT refund THEN
   IF jsonb_array_length(p_order->'paymentHistory')<>1 OR p_order->>'clientId' IS NOT NULL
     OR coalesce(p_order->>'client','')<>'' OR coalesce(p_order->>'delivery','')<>''
     OR coalesce(p_order->>'voidedAt','')<>'' THEN RAISE EXCEPTION 'INVALID_NEW_SALE'; END IF;
   IF (SELECT count(DISTINCT x->>'code') FROM jsonb_array_elements(p_order->'items') x)<>jsonb_array_length(p_order->'items') THEN RAISE EXCEPTION 'DUPLICATE_PRODUCT'; END IF;
   FOR line IN SELECT value FROM jsonb_array_elements(p_order->'items') LOOP
     code:=line->>'code';qty:=(line->>'qty')::numeric;price:=(line->>'price')::numeric;
     IF coalesce(code,'')='' OR qty IS NULL OR qty='NaN'::numeric OR qty<1 OR qty>100000 OR qty<>trunc(qty)
      OR price IS NULL OR price='NaN'::numeric OR price<0 OR price<>round(price,2) THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
     SELECT coalesce(sum((x->>'qty')::numeric),0) INTO made FROM jsonb_array_elements(coalesce(s.data->'productionRuns','[]')) r
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'products','[]')) x WHERE r->>'kind'='ready_stock' AND x->>'code'=code;
     tracked:=made>0;
     IF coalesce(line->'readyStockTracked'='true'::jsonb,false) IS DISTINCT FROM tracked THEN RAISE EXCEPTION 'READY_STOCK_CHANGED'; END IF;
     IF tracked THEN
       SELECT coalesce(sum((x->>'qty')::numeric),0) INTO sold FROM public.artessencia_v1_orders t
         CROSS JOIN LATERAL jsonb_array_elements(coalesce(t.data->'items','[]')) x
         WHERE t.user_id=a AND t.data->>'source'='direct_sale' AND x->>'code'=code AND x->'readyStockTracked'='true'::jsonb
         AND (coalesce(t.data->>'voidedAt','')='' OR t.data->'readyRestocked' IS DISTINCT FROM 'true'::jsonb);
       IF made-sold<qty THEN RAISE EXCEPTION 'INSUFFICIENT_READY_STOCK'; END IF;
     END IF;
     total_amount:=total_amount+qty*price;
   END LOOP;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_order->'items') x WHERE x->'readyStockTracked'='true'::jsonb) THEN RAISE EXCEPTION 'TRACKED_SALE_REQUIRED'; END IF;
   pay:=p_order->'paymentHistory'->0;paymentid:='PAY-'||rid::text||'-SALE';
   IF total_amount<=0 OR (p_order->>'total')::numeric IS DISTINCT FROM total_amount
    OR (p_order->>'subtotal')::numeric IS DISTINCT FROM total_amount OR (p_order->>'paid')::numeric IS DISTINCT FROM total_amount
    OR (pay->>'amount')::numeric IS DISTINCT FROM total_amount OR pay->>'type' IS DISTINCT FROM 'payment' THEN RAISE EXCEPTION 'INVALID_TOTAL'; END IF;
   result_data:=p_order;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.data->'items') x WHERE x->'readyStockTracked'='true'::jsonb)
    OR jsonb_typeof(p_order->'readyRestocked') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_RESTOCK'; END IF;
   total_amount:=o.total;pay:=p_order->'paymentHistory'->1;paymentid:='PAY-'||rid::text||'-REFUND';
   IF jsonb_array_length(o.data->'paymentHistory')<>1 OR jsonb_array_length(p_order->'paymentHistory')<>2
    OR o.data->'paymentHistory'->0 IS DISTINCT FROM p_order->'paymentHistory'->0
    OR (pay->>'amount')::numeric IS DISTINCT FROM -total_amount OR pay->>'type' IS DISTINCT FROM 'correction'
    OR (o.data->>'paid')::numeric IS DISTINCT FROM total_amount OR coalesce(p_order->>'voidedAt','')='' THEN RAISE EXCEPTION 'INVALID_REFUND'; END IF;
   result_data:=o.data||jsonb_build_object('status','Cancelado','paid',0,'voidedAt',p_order->>'voidedAt','voidedFrom','Entregue','voidedPaid',total_amount,'readyRestocked',p_order->'readyRestocked','paymentHistory',p_order->'paymentHistory');
 END IF;
 method:=pay->>'method';day:=(pay->>'localDate')::date;
 IF pay->>'id' IS DISTINCT FROM paymentid OR method IS NULL OR method NOT IN ('Dinheiro','MB Way','Multibanco','Transferência','Outro')
  OR method IS DISTINCT FROM result_data->>'payment' OR day IS NULL THEN RAISE EXCEPTION 'INVALID_PAYMENT'; END IF;
 cash:=coalesce(s.data->'cash','[]');
 IF jsonb_typeof(cash) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(cash) x WHERE x->>'paymentId'=paymentid OR x->>'id'='CASH-'||paymentid) THEN RAISE EXCEPTION 'DUPLICATE_PAYMENT'; END IF;
 movement:=jsonb_build_object('id','CASH-'||paymentid,'date',day,'type',CASE WHEN refund THEN 'Saída' ELSE 'Entrada' END,
  'desc',CASE WHEN refund THEN 'Devolução venda direta ' ELSE 'Venda direta ' END||saleid,'method',method,'value',total_amount,
  'source',CASE WHEN refund THEN 'order_payment_correction' ELSE 'order_payment' END,'orderId',saleid,'paymentId',paymentid);
 IF refund THEN
   UPDATE public.artessencia_v1_orders SET status='Cancelado',data=result_data,updated_at=stamp WHERE user_id=a AND id=rid RETURNING * INTO o;
 ELSE
   INSERT INTO public.artessencia_v1_orders(id,user_id,client_id,status,order_date,due_at,subtotal,total,notes,data,created_at,updated_at)
    VALUES(rid,a,NULL,'Entregue',(p_order->>'created')::date,NULL,total_amount,total_amount,p_order->>'notes',result_data,stamp,stamp) RETURNING * INTO o;
 END IF;
 UPDATE public.artessencia_v1_state SET data=jsonb_set(s.data,'{cash}',cash||jsonb_build_array(movement)),revision=s.revision+1,updated_at=stamp,device_id=p_device,app_version='1.9.191' WHERE user_id=a RETURNING * INTO s;
 RETURN jsonb_build_object('state',to_jsonb(s),'orders',jsonb_build_array(to_jsonb(o)),'replayed',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.artessencia_commit_ready_sale_v1(bigint,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artessencia_commit_ready_sale_v1(bigint,jsonb,text) TO authenticated;
