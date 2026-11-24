-- ArtEssencia: receção de contactos do catálogo sem criar encomendas.
-- Reutiliza a tabela de pedidos online existente, com RLS de proprietário.
-- A função só devolve a referência do pedido submetido; nunca expõe PII ao público.
create or replace function public.catalog_submit_contact_request_v1(p_payload jsonb)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
 v_owner uuid; v_id uuid; v_existing uuid;
 v_name text; v_phone text; v_email text; v_message text;
 v_kind text; v_code text; v_product text; v_token text;
 v_personalization jsonb; v_products jsonb := '[]'::jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Pedido inválido'; end if;
 if pg_catalog.octet_length(p_payload::text)>5000 then raise exception 'Pedido demasiado extenso'; end if;
 if coalesce(p_payload->>'website','') <> '' then raise exception 'Pedido inválido'; end if;
 if coalesce(p_payload->>'privacy_consent','false') <> 'true' then raise exception 'Consentimento obrigatório'; end if;
 select user_id into v_owner from public.store_owner where active is true order by created_at limit 1;
 if v_owner is null then raise exception 'Receção de pedidos indisponível'; end if;
 v_name := pg_catalog.btrim(coalesce(p_payload->>'name',''));
 v_phone := pg_catalog.regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9+]','','g');
 v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payload->>'email','')));
 v_message := pg_catalog.btrim(coalesce(p_payload->>'message',''));
 v_kind := pg_catalog.btrim(coalesce(p_payload->>'kind',''));
 v_code := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload->>'product_ref','')));
 v_token := pg_catalog.btrim(coalesce(p_payload->>'client_request_id',''));
 if length(v_name) not between 2 and 120 then raise exception 'Nome inválido'; end if;
 if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Telemóvel inválido'; end if;
 if length(v_email)>180 or (v_email <> '' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 then raise exception 'Email inválido'; end if;
 if length(v_message) not between 10 and 1500 then raise exception 'Mensagem inválida'; end if;
 if v_kind not in ('information','order','favorites','general') then raise exception 'Tipo de pedido inválido'; end if;
 if length(v_code)>45 then raise exception 'Referência demasiado extensa'; end if;
 if v_token !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
 then raise exception 'Identificador de pedido inválido'; end if;
 if v_code <> '' then
  select name into v_product from public.store_products
  where upper(code)=v_code and active=true limit 1;
  if v_product is null then raise exception 'Artigo não encontrado no catálogo'; end if;
  v_products := pg_catalog.jsonb_build_array(v_code || ' — ' || v_product);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':'||v_phone,0));
 select request_id into v_existing from public.artessencia_shop_event_requests
 where user_id=v_owner and personalization->>'source'='catalog'
 and personalization->>'request_kind'='catalog_contact'
 and personalization->>'client_request_id'=v_token
 limit 1;
 if v_existing is not null then return v_existing; end if;
 if exists(select 1 from public.artessencia_shop_event_requests
   where user_id=v_owner and phone=v_phone and created_at>now()-interval '90 seconds')
 then raise exception 'Já recebemos um pedido deste contacto. Aguarda antes de enviar outro.'; end if;
 if (select count(*) from public.artessencia_shop_event_requests
   where user_id=v_owner and phone=v_phone and created_at>now()-interval '15 minutes')>=3
 then raise exception 'Demasiados pedidos num curto período.'; end if;
 if (select count(*) from public.artessencia_shop_event_requests
   where user_id=v_owner and phone=v_phone and created_at>now()-interval '24 hours')>=8
 then raise exception 'Limite diário de pedidos atingido.'; end if;
 v_personalization := pg_catalog.jsonb_build_object(
   'source','catalog','request_kind','catalog_contact','intent',v_kind,
   'product_ref',nullif(v_code,''),'client_request_id',v_token,
   'privacy_consent',true
 );
 insert into public.artessencia_shop_event_requests (
  user_id,customer_name,phone,email,event_type,event_date,unidade_qty,
  products,personalization,notes,status,created_at,updated_at
 ) values (
  v_owner,v_name,v_phone,nullif(v_email,''),
  case v_kind when 'order' then 'Interesse em encomendar'
  when 'favorites' then 'Informação sobre favoritos'
  else 'Pedido de informação' end,
  null,null,v_products,v_personalization,v_message,'new',now(),now()
 ) returning request_id into v_id;
 return v_id;
end;
$$;
revoke all on function public.catalog_submit_contact_request_v1(jsonb) from public;
revoke all on function public.catalog_submit_contact_request_v1(jsonb) from anon;
revoke all on function public.catalog_submit_contact_request_v1(jsonb) from authenticated;
grant execute on function public.catalog_submit_contact_request_v1(jsonb) to anon;
-- Não são concedidas permissões de leitura pública sobre pedidos.
