\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.artessencia_v1_quotes(id uuid primary key,user_id uuid not null,client_id uuid,status text,total numeric,data jsonb);
create table public.artessencia_v10_quote_items(id uuid primary key,user_id uuid not null,quote_id uuid not null references public.artessencia_v1_quotes(id));
alter table public.artessencia_v1_quotes enable row level security;
alter table public.artessencia_v10_quote_items enable row level security;
create policy own_quote on public.artessencia_v1_quotes to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_item on public.artessencia_v10_quote_items to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.artessencia_v1_quotes,public.artessencia_v10_quote_items to authenticated;
\ir ../sql/quote_deletion_guard_v1.sql
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into public.artessencia_v1_quotes values('bbbbbbbb-0000-0000-0000-000000000001',auth.uid(),null,'Rascunho',12,'{"id":"Q-1","client":"Teste","items":[{"qty":1}]}');
insert into public.artessencia_v10_quote_items values('cccccccc-0000-0000-0000-000000000001',auth.uid(),'bbbbbbbb-0000-0000-0000-000000000001');
do $$begin
 if not public.artessencia_delete_quote_v1('bbbbbbbb-0000-0000-0000-000000000001') then raise exception 'delete not confirmed';end if;
 if not public.artessencia_delete_quote_v1('bbbbbbbb-0000-0000-0000-000000000001') then raise exception 'retry failed';end if;
 if exists(select 1 from public.artessencia_v1_quotes) or exists(select 1 from public.artessencia_v10_quote_items) then raise exception 'rows left';end if;
 begin
 insert into public.artessencia_v1_quotes values('bbbbbbbb-0000-0000-0000-000000000001',auth.uid(),null,'Rascunho',12,'{"id":"Q-1","client":"Teste","items":[{"qty":1}]}');
 raise exception 'resurrection accepted';exception when check_violation then null;end;
 begin
 insert into public.artessencia_v1_quotes values('bbbbbbbb-0000-0000-0000-000000000002',auth.uid(),null,'Rascunho',0,'{"code":"APR-TEST","category":"Velas","price":2,"cost":1,"productionType":"manual","items":[]}');
 raise exception 'product accepted';exception when check_violation then null;end;
end$$;
insert into public.artessencia_v1_quotes values('bbbbbbbb-0000-0000-0000-000000000003',auth.uid(),null,'Rascunho',12,'{"id":"Q-1","client":"Novo","items":[{"qty":1}]}');
delete from public.artessencia_v1_quotes where id='bbbbbbbb-0000-0000-0000-000000000003';
do $$begin
 if (select count(*) from public.artessencia_quote_deletions_v1)<>2 then raise exception 'legacy delete not recorded';end if;
end$$;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
do $$begin
 if exists(select 1 from public.artessencia_quote_deletions_v1) then raise exception 'RLS leaked';end if;
end$$;
reset role;
