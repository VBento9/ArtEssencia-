-- ArtEssencia Boxes: only explicit owner conversion, no stock or payment mutation.
-- Deployed independently of UI; safe to repeat (idempotent constraints).
create table if not exists public.artessencia_box_order_links_v1 (
 request_id uuid primary key references public.artessencia_box_requests_v1(request_id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null unique references public.artessencia_v1_orders(id) on delete restrict,
 public_order_id text not null,
 quote_version integer not null check (quote_version between 1 and 1000),
 box_id text not null,
 technical_version integer not null check (technical_version >= 1),
 created_at timestamptz not null default now()
);
create index if not exists artessencia_box_order_links_owner_idx
 on public.artessencia_box_order_links_v1(user_id,created_at desc);
alter table public.artessencia_box_order_links_v1 enable row level security;
revoke all on public.artessencia_box_order_links_v1 from public,anon,authenticated;
grant select on public.artessencia_box_order_links_v1 to authenticated;
grant select,insert,update,delete on public.artessencia_box_order_links_v1 to service_role;
drop policy if exists artessencia_box_order_links_owner_select on public.artessencia_box_order_links_v1;
create policy artessencia_box_order_links_owner_select on public.artessencia_box_order_links_v1
 for select to authenticated
 using(user_id=(select auth.uid()) and (select public.artessencia_is_owner_v1()));

create or replace function public.artessencia_owner_convert_box_v1(
 p_request_id uuid, p_box_id text, p_expected_box_version integer, p_delivery_date date
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
 u uuid; r public.artessencia_box_requests_v1%rowtype;
 link public.artessencia_box_order_links_v1%rowtype;
 state jsonb; box jsonb; snapshot jsonb; lines jsonb:='[]'::jsonb;
 line jsonb; code text; name text; seen text[]:=array[]::text[];
 qty integer; n integer; matches integer; found_products integer;
 ver integer; cost numeric; amount numeric; order_id uuid; public_id text;
 ts timestamptz:=now(); body jsonb;
begin
 u:=(select auth.uid());
 if u is null or not (select public.artessencia_is_owner_v1()) then
  raise exception 'Acesso exclusivo ao proprietário';
 end if;
 if p_request_id is null or p_box_id is null or
  length(p_box_id) not between 2 and 150 or p_expected_box_version<1 then
  raise exception 'Referência da ficha inválida';
 end if;
 -- Serialized per request, preventing simultaneous conversions on devices.
 select * into r from public.artessencia_box_requests_v1
  where request_id=p_request_id and user_id=u for update;
 if not found then raise exception 'Proposta não encontrada'; end if;
 select * into link from public.artessencia_box_order_links_v1
  where request_id=p_request_id and user_id=u;
 if found then return jsonb_build_object('ok',true,'already_converted',true,
  'order_id',link.order_id,'public_order_id',link.public_order_id); end if;
 if r.status<>'accepted' or r.responded_at is null or r.quote_version<1 or
  r.quoted_total is null or r.quoted_total<=0 or r.quoted_total>100000 or
  scale(r.quoted_total)>2 then raise exception 'Aceitação e orçamento válidos obrigatórios'; end if;
 amount:=r.quoted_total;
 if p_delivery_date is null or p_delivery_date<(ts at time zone 'Europe/Lisbon')::date
  or p_delivery_date>(ts at time zone 'Europe/Lisbon')::date+365 then
  raise exception 'Data de entrega inválida';
 end if;
 select s.data into state from public.artessencia_v1_state s
  where s.user_id=u for share;
 if not found or jsonb_typeof(state->'themedBoxes')<>'array' then
  raise exception 'Fichas de Boxes não sincronizadas';
 end if;
 select count(*) into matches from jsonb_array_elements(state->'themedBoxes') x(value)
  where x.value->>'id'=p_box_id and x.value->>'originRequestId'=p_request_id::text;
 if matches<>1 then raise exception 'Ficha da proposta ausente ou duplicada';end if;
 select x.value into box from jsonb_array_elements(state->'themedBoxes') x(value)
  where x.value->>'id'=p_box_id and x.value->>'originRequestId'=p_request_id::text;
 if box->'active' is distinct from 'false'::jsonb or
  box->'technicalV2'->>'mode'<>'finished' then
  raise exception 'Ficha não privada ou produção conjunta ainda não suportada';
 end if;
 if coalesce(box->'technicalRevisionV4'->>'version','')!~'^[0-9]{1,6}$' then
  raise exception 'Revisão técnica inválida';end if;
 ver:=(box->'technicalRevisionV4'->>'version')::integer;
 if ver<>p_expected_box_version then raise exception 'Ficha modificada noutro dispositivo';end if;
 snapshot:=box->'technicalRevisionV4'->'snapshot';
 if jsonb_typeof(snapshot->'total')<>'number' or
  jsonb_typeof(box->'price')<>'number' then
  raise exception 'Custo técnico ou PVP em falta'; end if;
 cost:=(snapshot->>'total')::numeric;
 if cost<=0 or cost>100000 or cost::text='NaN' then
  raise exception 'Custo técnico inválido';end if;
 if round((box->>'price')::numeric,2)<>amount then
  raise exception 'Preço da ficha diferente do orçamento aceite';end if;
 if jsonb_typeof(r.items)<>'array' or jsonb_typeof(box->'items')<>'array' then
  raise exception 'Composição inválida';end if;
 n:=jsonb_array_length(r.items);
 if n<1 or n>12 or jsonb_array_length(box->'items')<>n then
  raise exception 'Quantidade de linhas incompatível';end if;
 for line in select value from jsonb_array_elements(r.items) loop
  if jsonb_typeof(line)<>'object' then raise exception 'Linha inválida';end if;
  code:=btrim(coalesce(line->>'code',''));
  if length(code) not between 1 and 100 or
   coalesce(line->>'qty','')!~'^[0-9]{1,2}$' then
   raise exception 'Código ou quantidade inválidos';end if;
  qty:=(line->>'qty')::integer;
  if qty not between 1 and 24 or code=any(seen) then
   raise exception 'Artigos repetidos ou quantidades inválidas';end if;
  seen:=array_append(seen,code);
  select count(*) into matches from jsonb_array_elements(box->'items') x(value)
    where x.value->>'code'=code and x.value->>'qty'=qty::text;
  if matches<>1 then raise exception 'Composição da Box diferente da proposta';end if;
  select count(*),max(p.name) into found_products,name
   from public.artessencia_v1_products p
   where p.user_id=u and p.data->>'code'=code and p.active is distinct from false;
  if found_products<>1 or coalesce(btrim(name),'')='' then
   raise exception 'Produto indisponível ou código repetido: %',code;end if;
  lines:=lines||jsonb_build_array(jsonb_build_object(
   'code',code,'name',name,'qty',qty,'price',0,'cost',0,
   'type','box_component','originBoxRequestId',p_request_id
  ));
 end loop;
 -- Global quote represented as an adjustment, ignored by production.
 lines:=lines||jsonb_build_array(jsonb_build_object(
  'code','','name','Valor total aprovado da Box','qty',1,
  'price',amount,'cost',0,'type','quote_adjustment'));
 order_id:=gen_random_uuid();
 public_id:='BX-'||to_char(ts at time zone 'Europe/Lisbon','YYYY')||'-'||
    upper(substr(replace(p_request_id::text,'-',''),1,16));
 body:=jsonb_build_object(
  'id',public_id,'_rid',order_id,
  'created',(ts at time zone 'Europe/Lisbon')::date,
  'client',r.customer_name,'contact',r.phone,'email',r.email,
  'delivery',p_delivery_date,'status','Pedido','payment','A definir',
  'paid',0,'paymentHistory','[]'::jsonb,'source','box_quote',
  'items',lines,'box',coalesce(box->>'basePackaging',''),
  'boxes',1,'boxCostSnapshot',cost,'subtotal',amount,'total',amount,
  'discountTotal',0,'notes',coalesce(r.customer_note,''),
  'originBoxRequestId',p_request_id,'originBoxQuoteVersion',r.quote_version,
  'sourceBoxId',p_box_id,'sourceBoxTechnicalVersion',ver,
  'boxTechnicalSnapshot',snapshot,'boxTechnicalItems',box->'items',
  'boxTechnicalMode','finished','requiresManualConfirmation',true,'stockReserved',false
 );
 insert into public.artessencia_v1_orders
 (id,user_id,status,order_date,due_at,subtotal,total,notes,data)
 values(order_id,u,'Pedido',(ts at time zone 'Europe/Lisbon')::date,
  (p_delivery_date::text||'T12:00:00Z')::timestamptz,
  amount,amount,'Proposta de Box aceite '||p_request_id::text,body);
 insert into public.artessencia_box_order_links_v1
 (request_id,user_id,order_id,public_order_id,quote_version,box_id,technical_version)
 values(p_request_id,u,order_id,public_id,r.quote_version,p_box_id,ver);
 return jsonb_build_object('ok',true,'already_converted',false,
  'order_id',order_id,'public_order_id',public_id,'quote_version',r.quote_version,
  'technical_version',ver);
end;
$fn$;
revoke all on function public.artessencia_owner_convert_box_v1(uuid,text,integer,date) from public,anon;
grant execute on function public.artessencia_owner_convert_box_v1(uuid,text,integer,date) to authenticated;
