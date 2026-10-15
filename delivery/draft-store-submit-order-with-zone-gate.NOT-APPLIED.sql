-- RASCUNHO DE CHECKOUT COMPLETO: NÃO APLICAR. ZONAS ATIVAS FALHAM EM SEGURANÇA.
-- Baseado na função de produção consultada apenas para leitura.
-- Calendário Lisboa implementado no ramo; falta testar PostgreSQL, rever horários legados e permissões.
CREATE OR REPLACE FUNCTION public.store_submit_order_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
  v_enabled boolean;
  v_accepting boolean;
  v_name text;
  v_phone text;
  v_phone_key text;
  v_email text;
  v_email_key text;
  v_fulfillment text;
  v_requested_date date;
  v_requested_time time;
  v_notes text;
  v_address text;
  v_postal text;
  v_request_id text;
  v_customer_id uuid;
  v_bo_client_id uuid;
  v_bo_client_app_id text;
  v_bo_client_data jsonb;
  v_order_id uuid;
  v_order_number text;
  v_existing_order public.store_orders%rowtype;
  v_item jsonb;
  v_customization jsonb;
  v_product public.store_products%rowtype;
  v_qty integer;
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2):=0;
  v_fee numeric(12,2):=0;
  v_total numeric(12,2):=0;
  v_items jsonb;
  v_backoffice_data jsonb;
  v_s jsonb;
  v_ex jsonb;
  v_dow int;
  v_start time;
  v_end time;
  v_existing_orders int;
  v_existing_units int;
  v_new_units int:=0;
  v_prefix text;
begin
  select user_id into v_owner from public.store_owner where active=true order by created_at limit 1;
  if v_owner is null then raise exception 'store owner not configured'; end if;

  select coalesce((value->>'enabled')::boolean,false),coalesce((value->>'accepting_orders')::boolean,false)
    into v_enabled,v_accepting from public.store_settings where key='store_status';
  if not coalesce(v_enabled,false) or not coalesce(v_accepting,false) then raise exception 'store is not accepting orders'; end if;

  select coalesce(data->'delivery','{}'::jsonb) into v_s
    from public.artessencia_shop_settings where user_id=v_owner;

  v_name:=nullif(trim(coalesce(p_payload->>'name','')),'');
  v_phone:=nullif(trim(coalesce(p_payload->>'phone','')),'');
  v_phone_key:=regexp_replace(coalesce(v_phone,''),'[^0-9]','','g');
  v_email:=nullif(trim(coalesce(p_payload->>'email','')),'');
  v_email_key:=lower(coalesce(v_email,''));
  v_fulfillment:=upper(nullif(trim(coalesce(p_payload->>'fulfillment_type','')),''));
  v_requested_date:=nullif(p_payload->>'requested_date','')::date;
  v_requested_time:=nullif(p_payload->>'requested_time','')::time;
  v_notes:=nullif(trim(coalesce(p_payload->>'notes','')),'');
  v_address:=nullif(trim(coalesce(p_payload->>'delivery_address','')),'');
  v_postal:=regexp_replace(coalesce(p_payload->>'delivery_postal_code',''),'[^0-9]','','g');
  v_request_id:=nullif(trim(coalesce(p_payload->>'request_id','')),'');
  v_items:=coalesce(p_payload->'items','[]'::jsonb);

  if v_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('artessencia-request-'||v_request_id));
    select * into v_existing_order from public.store_orders where client_request_id=v_request_id limit 1;
    if found then
      if not exists (
        select 1
        from public.store_customers c
        where c.id=v_existing_order.customer_id
          and (
            (
              length(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g'))=9
              and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')
                  =regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g')
            )
            or
            (
              nullif(lower(trim(coalesce(p_payload->>'email',''))),'') is not null
              and lower(trim(coalesce(c.email,'')))
                  =lower(trim(coalesce(p_payload->>'email','')))
            )
          )
      ) then
        raise exception 'request could not be processed';
      end if;
      return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_existing_order.id,'order_number',v_existing_order.order_number,'subtotal',v_existing_order.subtotal,'fulfillment_fee',v_existing_order.fulfillment_fee,'total',v_existing_order.total,'requested_date',v_existing_order.requested_date,'requested_time',v_existing_order.requested_time);
    end if;
  end if;

  if v_name is null then raise exception 'name required'; end if;
  if v_phone is null and v_email is null then raise exception 'phone or email required'; end if;
  if v_phone is not null and length(v_phone_key)<>9 then raise exception 'invalid phone'; end if;
  if v_fulfillment not in ('LEVANTAMENTO','ENTREGA') then raise exception 'invalid fulfillment type'; end if;
  if v_requested_date is null or v_requested_time is null then raise exception 'booking date and time required'; end if;
  if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'order items required'; end if;

  if v_requested_date<current_date+coalesce((v_s->>'leadDays')::int,0) then raise exception 'minimum lead time not met'; end if;
  v_dow:=extract(dow from v_requested_date)::int;
  select x into v_ex from jsonb_array_elements(coalesce(v_s->'dateExceptions','[]'::jsonb)) x where x->>'date'=v_requested_date::text limit 1;
  if coalesce((v_ex->>'closed')::boolean,false) then raise exception 'selected date is closed'; end if;
  if NOT (v_fulfillment='ENTREGA' AND v_s #>> '{deliveryZoneConfig,enabled}'='true') AND v_ex is null and not (v_dow in (select value::int from jsonb_array_elements_text(coalesce(v_s->'allowedWeekdays','[]'::jsonb)))) then raise exception 'selected weekday unavailable'; end if;

  if v_fulfillment='LEVANTAMENTO' then
    if not (case when v_ex is null then coalesce((v_s->>'pickupEnabled')::boolean,false) else coalesce((v_ex->>'pickupEnabled')::boolean,false) end) then raise exception 'pickup unavailable'; end if;
    v_start:=coalesce(nullif(v_ex->>'pickupStart','')::time,nullif(v_s->>'pickupStart','')::time);
    v_end:=coalesce(nullif(v_ex->>'pickupEnd','')::time,nullif(v_s->>'pickupEnd','')::time);
    v_fee:=coalesce((v_s->>'pickupFee')::numeric,0);
  else
    if not (case when v_ex is null then coalesce((v_s->>'localDeliveryEnabled')::boolean,false) else coalesce((v_ex->>'localDeliveryEnabled')::boolean,false) end) then raise exception 'local delivery unavailable'; end if;
    if v_address is null then raise exception 'delivery address required'; end if;
    if length(v_postal)<>7 then raise exception 'delivery postal code required'; end if;
    v_prefix:=left(v_postal,4);
    if NOT (v_s #>> '{deliveryZoneConfig,enabled}'='true') AND jsonb_array_length(coalesce(v_s->'postalPrefixes','[]'::jsonb))>0 and not (v_prefix in (select value from jsonb_array_elements_text(coalesce(v_s->'postalPrefixes','[]'::jsonb)))) then raise exception 'delivery area unavailable'; end if;
    v_start:=coalesce(nullif(v_ex->>'localStart','')::time,nullif(v_s->>'localStart','')::time);
    v_end:=coalesce(nullif(v_ex->>'localEnd','')::time,nullif(v_s->>'localEnd','')::time);
    v_fee:=coalesce((v_s->>'localDeliveryFee')::numeric,0);
  end if;

  if v_start is null or v_end is null or v_requested_time<v_start or v_requested_time>v_end then raise exception 'selected time unavailable'; end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from public.store_products where id=(v_item->>'product_id')::uuid and active=true and available=true;
    if not found then raise exception 'product unavailable'; end if;
    v_qty:=coalesce((v_item->>'quantity')::integer,0);
    if v_qty<=0 then raise exception 'invalid quantity'; end if;
    v_customization:=coalesce(v_item->'customization','{}'::jsonb);
    if jsonb_typeof(v_customization)<>'object' then raise exception 'invalid customization'; end if;
    if not coalesce(v_product.customizable,false) and v_customization<>'{}'::jsonb then raise exception 'product is not customizable'; end if;
    if coalesce(v_product.customizable,false) and length(coalesce(v_customization->>'text',''))>250 then raise exception 'customization too long'; end if;
    v_new_units:=v_new_units+v_qty;
    v_subtotal:=v_subtotal+round(v_product.price_online*v_qty,2);
  end loop;

  if v_fulfillment='ENTREGA' and v_subtotal<coalesce((v_s->>'minOrderLocalDelivery')::numeric,0) then raise exception 'minimum order for delivery not met'; end if;
  -- Entregas por zonas: substitui tarifa geral SOMENTE quando ativadas.
  -- A configuracao v_s foi lida da base, e v_postal foi normalizado no servidor.
  IF v_fulfillment='ENTREGA' AND v_s #>> '{deliveryZoneConfig,enabled}'='true' THEN
    -- Hora local do agendamento resolvida em instante real com timezone PostgreSQL.
    -- DST: rejeitar horários não existentes e ambíguos na mudança de hora.
    IF v_dow NOT IN (0,1) THEN RAISE EXCEPTION 'delivery weekday unavailable'; END IF;
    IF v_requested_date <
      (timezone('Europe/Lisbon',clock_timestamp())::date
       + ((7-extract(dow from timezone('Europe/Lisbon',clock_timestamp()))::int)%7)
       + CASE WHEN extract(dow from timezone('Europe/Lisbon',clock_timestamp()))::int IN (0,5,6) THEN 7 ELSE 0 END)
    THEN RAISE EXCEPTION 'weekly delivery cutoff'; END IF;
    IF (v_requested_date + v_requested_time)
       <> timezone('Europe/Lisbon', (v_requested_date + v_requested_time) AT TIME ZONE 'Europe/Lisbon')
    THEN RAISE EXCEPTION 'nonexistent delivery time'; END IF;
    IF timezone('Europe/Lisbon', ((v_requested_date + v_requested_time) AT TIME ZONE 'Europe/Lisbon') - interval '1 hour')
       = (v_requested_date + v_requested_time)
       OR timezone('Europe/Lisbon', ((v_requested_date + v_requested_time) AT TIME ZONE 'Europe/Lisbon') + interval '1 hour')
       = (v_requested_date + v_requested_time)
    THEN RAISE EXCEPTION 'ambiguous delivery time'; END IF;
    IF ((v_requested_date + v_requested_time) AT TIME ZONE 'Europe/Lisbon') - clock_timestamp() < interval '48 hours'
    THEN RAISE EXCEPTION 'minimum preparation time'; END IF;
    v_fee := public.artessencia_delivery_fee_from_zones_draft(
      substring(v_postal from 1 for 4)||'-'||substring(v_postal from 5 for 3),v_s
    )::numeric/100;
  END IF;


  perform pg_advisory_xact_lock(hashtext('artessencia-capacity-'||v_requested_date::text));
  select count(*),coalesce(sum((select coalesce(sum(quantity),0) from public.store_order_items i where i.order_id=o.id)),0)
    into v_existing_orders,v_existing_units
    from public.store_orders o
    where o.requested_date=v_requested_date and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED');
  if coalesce((v_s->>'maxOrdersPerDay')::int,0)>0 and v_existing_orders>=coalesce((v_s->>'maxOrdersPerDay')::int,0) then raise exception 'daily order capacity reached'; end if;
  if coalesce((v_s->>'maxUnitsPerDay')::int,0)>0 and v_existing_units+v_new_units>coalesce((v_s->>'maxUnitsPerDay')::int,0) then raise exception 'daily unit capacity reached'; end if;


  -- Unverified public contact details must never modify or claim an existing customer.
  -- Each online order receives an isolated, provisional identity pending owner review.
  v_bo_client_id:=gen_random_uuid();
  v_bo_client_app_id:='CLI-WEB-'||upper(left(replace(v_bo_client_id::text,'-',''),10));
  v_bo_client_data:=jsonb_build_object('id',v_bo_client_app_id,'_rid',v_bo_client_id::text,'name',v_name,'phone',coalesce(v_phone,''),'email',coalesce(v_email,''),'notes','','note','','source','online_store','identityStatus','pending_owner_review','created',current_date::text);
  insert into public.artessencia_v1_clients(id,user_id,name,phone,email,notes,data,created_at,updated_at)
  values(v_bo_client_id,v_owner,v_name,v_phone,v_email,null,v_bo_client_data,now(),now());
  insert into public.store_customers(backoffice_customer_id,name,phone,email,notes)
  values(v_bo_client_app_id,v_name,v_phone,v_email,null) returning id into v_customer_id;

  v_order_number:=public.store_next_order_number_v1();
  v_total:=round(v_subtotal+v_fee,2);
  insert into public.store_orders(order_number,customer_id,status,fulfillment_type,requested_date,requested_time,subtotal,extras_total,fulfillment_fee,total,customer_notes,source,delivery_address,delivery_postal_code,client_request_id)
  values(v_order_number,v_customer_id,'PEDIDO',v_fulfillment,v_requested_date,v_requested_time,v_subtotal,v_fee,v_fee,v_total,v_notes,'LOJA',v_address,v_postal,v_request_id)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from public.store_products where id=(v_item->>'product_id')::uuid and active=true and available=true;
    v_qty:=(v_item->>'quantity')::integer;
    v_customization:=coalesce(v_item->'customization','{}'::jsonb);
    v_line_total:=round(v_product.price_online*v_qty,2);
    insert into public.store_order_items(order_id,product_id,product_code,product_name,quantity,unit_price,customization,line_total)
    values(v_order_id,v_product.id,v_product.code,v_product.name,v_qty,v_product.price_online,v_customization,v_line_total);
  end loop;

  v_backoffice_data:=jsonb_build_object(
    'id',gen_random_uuid()::text,
    'source','online_store',
    'storeOrderId',v_order_id::text,
    'requestId',v_request_id,
    'orderNumber',v_order_number,
    'clientId',v_bo_client_app_id,
    'client',v_name,'contact',v_phone,'email',v_email,'delivery',v_requested_date::text,'clientName',v_name,
    'clientPhone',v_phone,
    'clientEmail',v_email,
    'status','Pedido',
    'fulfillmentType',v_fulfillment,
    'requestedDate',v_requested_date::text,
    'requestedTime',v_requested_time::text,
    'deliveryAddress',v_address,
    'deliveryPostalCode',v_postal,
    'fulfillmentFee',v_fee,
    'notes',v_notes,
    'subtotal',v_subtotal,
    'total',v_total,
    'items',(select jsonb_agg(jsonb_build_object('productId',soi.product_id::text,'code',soi.product_code,'name',soi.product_name,'quantity',soi.quantity,'unitPrice',soi.unit_price,'lineTotal',soi.line_total,'customization',soi.customization)) from public.store_order_items soi where soi.order_id=v_order_id)
  );

  insert into public.artessencia_v1_orders(id,user_id,client_id,status,order_date,due_at,subtotal,total,notes,data)
  values((v_backoffice_data->>'id')::uuid,v_owner,v_bo_client_id,'Pedido',current_date,(v_requested_date::text||' '||v_requested_time::text)::timestamp,v_subtotal,v_total,v_notes,v_backoffice_data);

  update public.store_orders set backoffice_order_id=v_backoffice_data->>'id',updated_at=now() where id=v_order_id;

  return jsonb_build_object('ok',true,'duplicate',false,'order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'fulfillment_fee',v_fee,'total',v_total,'requested_date',v_requested_date,'requested_time',v_requested_time);
end $function$

