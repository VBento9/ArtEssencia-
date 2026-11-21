-- A referência pública do orçamento é única dentro da conta que o converte.
create unique index artessencia_orders_quote_once_v1
  on public.artessencia_v1_orders (user_id, (data->>'sourceQuoteId'))
  where nullif(data->>'sourceQuoteId','') is not null;

create function public.artessencia_convert_quote_once_v1(
  p_account uuid, p_quote jsonb, p_order jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  quote_ref text := nullif(p_quote->>'id','');
  q public.artessencia_v1_quotes%rowtype;
  o public.artessencia_v1_orders%rowtype;
  order_uuid uuid;
  reused boolean;
  stamp timestamptz := now();
begin
  if account_id is null or p_account is distinct from account_id then
    raise exception 'Volte a entrar na conta para converter o orçamento.';
  end if;
  -- Serializa duas sessões e lê a versão confirmada após a espera.
  begin
    select * into strict q from public.artessencia_v1_quotes
      where user_id=account_id and data->>'id'=quote_ref for update;
  exception when no_data_found or too_many_rows then
    raise exception 'Sincronize o orçamento antes de converter.';
  end;
  select * into o from public.artessencia_v1_orders
    where user_id=account_id and data->>'sourceQuoteId'=quote_ref;
  reused := found;
  if not reused then
    if q.status <> 'Aceite' or nullif(q.data->>'orderId','') is not null
      or (q.data - '_rid') is distinct from (p_quote - '_rid') then
      raise exception 'O orçamento mudou. Sincronize e reveja os dados.';
    end if;
    if p_order->>'sourceQuoteId' is distinct from quote_ref
      or nullif(p_order->>'id','') is null or p_order->>'status' is distinct from 'Confirmada'
      or jsonb_typeof(p_order->'items') is distinct from 'array' or jsonb_array_length(p_order->'items')=0 then
      raise exception 'Dados de conversão inválidos.';
    end if;
    order_uuid := gen_random_uuid();
    insert into public.artessencia_v1_orders
      (id,user_id,client_id,status,order_date,due_at,subtotal,total,notes,data)
    values (order_uuid,account_id,q.client_id,'Confirmada',(p_order->>'created')::date,
      ((q.data->>'eventDate')||'T12:00:00Z')::timestamptz,q.total,q.total,p_order->>'notes',
      p_order||jsonb_build_object('_rid',order_uuid))
    returning * into o;
  end if;
  if q.status <> 'Convertido' or q.data->>'orderId' is distinct from o.data->>'id' then
    update public.artessencia_v1_quotes set status='Convertido',updated_at=stamp,
      data=q.data||jsonb_build_object('status','Convertido','orderId',o.data->>'id',
        'convertedAt',stamp,'statusHistory',coalesce(nullif(q.data->'statusHistory','null'::jsonb),'[]'::jsonb)||
        jsonb_build_array(jsonb_build_object('date',stamp,'status','Convertido','from',q.status,
          'to','Convertido','source','conversion','orderId',o.data->>'id')))
      where user_id=account_id and id=q.id returning * into strict q;
  end if;
  return jsonb_build_object('order',o.data||jsonb_build_object('_rid',o.id),
    'quote',q.data||jsonb_build_object('_rid',q.id),'reused',reused);
end;
$$;
revoke all on function public.artessencia_convert_quote_once_v1(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.artessencia_convert_quote_once_v1(uuid,jsonb,jsonb) to authenticated;
