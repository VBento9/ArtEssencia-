CREATE OR REPLACE FUNCTION public.artessencia_complete_production_backoffice_v1(p_revision bigint, p_run jsonb, p_orders jsonb, p_products jsonb, p_device text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 actor uuid := auth.uid();
 state_row public.artessencia_v1_state%rowtype;
 order_row public.artessencia_v1_orders%rowtype;
 product_row public.artessencia_v1_products%rowtype;
 snapshot jsonb; material record; stock_item jsonb; previous_run jsonb;
 next_stock jsonb; next_moves jsonb; result_orders jsonb := '[]';
 ids jsonb; run jsonb; amount numeric; available numeric; hits integer;
 stamp timestamptz := clock_timestamp();
 line record; ingredient jsonb; frozen jsonb; recipe jsonb; source_product jsonb;
 expected_materials jsonb := '{}'; order_needs jsonb; expected_order_materials jsonb := '{}';
 name text; quantity numeric; per_unit numeric; product_count integer;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if jsonb_typeof(p_run) is distinct from 'object' or coalesce(p_run->>'id','')='' or
    jsonb_typeof(p_orders) is distinct from 'array' or jsonb_array_length(p_orders)=0 or
    jsonb_typeof(p_products) is distinct from 'array' or
    jsonb_typeof(p_run->'materials') is distinct from 'object' then
   raise exception 'INVALID_PRODUCTION_REQUEST';
 end if;
 select * into state_row from public.artessencia_v1_state where user_id=actor for update;
 if not found then raise exception 'CANONICAL_STATE_REQUIRED'; end if;
 select coalesce(jsonb_agg(x->'data'->'id' order by x->'data'->>'id'),'[]') into ids from jsonb_array_elements(p_orders) x;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_orders) x)<>jsonb_array_length(p_orders) or
    (select count(distinct x->'data'->>'id') from jsonb_array_elements(p_orders) x)<>jsonb_array_length(p_orders) then
   raise exception 'DUPLICATE_ORDER';
 end if;
 select x into previous_run from jsonb_array_elements(coalesce(state_row.data->'productionRuns','[]')) x where x->>'id'=p_run->>'id';
 if previous_run is not null then
   if previous_run->'orders' is distinct from ids or exists(select 1 from jsonb_each(previous_run->'materials') m full join jsonb_each(p_run->'materials') n on m.key=n.key where m.key is null or n.key is null or jsonb_typeof(n.value)<>'number' or abs(m.value::text::numeric-n.value::text::numeric)>0.00000001) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   select coalesce(jsonb_agg(to_jsonb(o)),'[]') into result_orders from public.artessencia_v1_orders o
     where o.user_id=actor and o.id in (select (x->>'id')::uuid from jsonb_array_elements(p_orders) x);
   return jsonb_build_object('state',to_jsonb(state_row),'orders',result_orders,'replayed',true);
 end if;
 if state_row.revision is distinct from p_revision then raise exception using errcode='40001',message='cloud_revision_conflict'; end if;
 -- Lock every source in stable order; stale recipes/orders cannot commit.
 for snapshot in select x from jsonb_array_elements(p_products) x order by x->>'id' loop
   select * into product_row from public.artessencia_v1_products where user_id=actor and id=(snapshot->>'id')::uuid for update;
   if not found or product_row.data is distinct from snapshot->'data' or product_row.updated_at is distinct from (snapshot->>'updated_at')::timestamptz then raise exception 'PRODUCT_CHANGED'; end if;
 end loop;
 for snapshot in select x from jsonb_array_elements(p_orders) x order by x->>'id' loop
   select * into order_row from public.artessencia_v1_orders where user_id=actor and id=(snapshot->>'id')::uuid for update;
   if not found or order_row.data is distinct from snapshot->'data' or order_row.updated_at is distinct from (snapshot->>'updated_at')::timestamptz then raise exception 'ORDER_CHANGED'; end if;
   if coalesce(order_row.status,'') not in ('Em produção','Produção') or coalesce(order_row.data->>'status','') not in ('Em produção','Produção') then raise exception 'ORDER_NOT_IN_PRODUCTION'; end if;
   if exists(select 1 from jsonb_array_elements(coalesce(state_row.data->'productionRuns','[]')) r where r->'orders' ? (order_row.data->>'id')) then raise exception 'ORDER_ALREADY_PRODUCED'; end if;
   -- Derive consumptions from locked canonical sources. Never trust client totals.
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
   expected_order_materials:=jsonb_set(expected_order_materials,array[order_row.data->>'id'],order_needs);
   for material in select key,value from jsonb_each(order_needs) loop
     expected_materials:=jsonb_set(expected_materials,array[material.key],to_jsonb(coalesce((expected_materials->>material.key)::numeric,0)+material.value::text::numeric));
   end loop;
 end loop;
 if (select count(*) from jsonb_object_keys(expected_materials))<>(select count(*) from jsonb_object_keys(p_run->'materials')) then raise exception 'MATERIAL_CONTRACT_MISMATCH'; end if;
 for material in select key,value from jsonb_each(expected_materials) loop
   if jsonb_typeof(p_run->'materials'->material.key) is distinct from 'number' or abs((p_run->'materials'->>material.key)::numeric-material.value::text::numeric)>0.00000001 then raise exception 'MATERIAL_CONTRACT_MISMATCH'; end if;
 end loop;
 next_stock := state_row.data->'stock'; next_moves := coalesce(state_row.data->'stockMoves','[]');
 if jsonb_typeof(next_stock) is distinct from 'array' then raise exception 'INVALID_STOCK'; end if;
 for material in select key,value from jsonb_each(expected_materials) loop
   if jsonb_typeof(material.value)<>'number' then raise exception 'INVALID_QUANTITY'; end if;
   amount := material.value::text::numeric;
   if amount<=0 then raise exception 'INVALID_QUANTITY'; end if;
   select count(*),min((x->>'qty')::numeric) into hits,available from jsonb_array_elements(next_stock) x where x->>'name'=material.key;
   if hits<>1 or available is null or available<amount then raise exception 'INSUFFICIENT_OR_AMBIGUOUS_STOCK'; end if;
   select jsonb_agg(case when x->>'name'=material.key then jsonb_set(x,'{qty}',to_jsonb(available-amount)) else x end order by position)
     into next_stock from jsonb_array_elements(next_stock) with ordinality as t(x,position);
   next_moves := next_moves || jsonb_build_array(jsonb_build_object('date',stamp,'item',material.key,'type','production','qty',amount,'beforeQty',available,'afterQty',available-amount,'productionRunId',p_run->>'id','orderIds',ids,'note','Produção '||(p_run->>'date')));
 end loop;
 run := p_run || jsonb_build_object('orders',ids,'createdAt',stamp,'materials',expected_materials,'orderMaterials',expected_order_materials);
 update public.artessencia_v1_state set data=jsonb_set(jsonb_set(jsonb_set(state_row.data,'{stock}',next_stock),'{stockMoves}',next_moves),'{productionRuns}',coalesce(state_row.data->'productionRuns','[]')||jsonb_build_array(run)),revision=state_row.revision+1,updated_at=stamp,device_id=p_device,app_version='1.9.26'
   where user_id=actor returning * into state_row;
 for snapshot in select x from jsonb_array_elements(p_orders) x order by x->>'id' loop
   update public.artessencia_v1_orders set status='Pronta',updated_at=stamp,
     data=data || jsonb_build_object('status','Pronta','readyAt',coalesce(data->>'readyAt',stamp::text),'statusHistory',coalesce(data->'statusHistory','[]')||jsonb_build_array(jsonb_build_object('from',status,'to','Pronta','date',stamp,'source','production')))
     where user_id=actor and id=(snapshot->>'id')::uuid returning * into order_row;
   result_orders:=result_orders||jsonb_build_array(to_jsonb(order_row));
 end loop;
 return jsonb_build_object('state',to_jsonb(state_row),'orders',result_orders,'replayed',false);
end;
$function$
;
REVOKE ALL ON FUNCTION public.artessencia_complete_production_backoffice_v1(bigint,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artessencia_complete_production_backoffice_v1(bigint,jsonb,jsonb,jsonb,text) TO authenticated;
