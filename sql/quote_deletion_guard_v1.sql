-- Review in staging before applying. No existing rows are deleted by this migration.
begin;
create table if not exists public.artessencia_quote_deletions_v1 (
 user_id uuid not null,
 quote_id uuid not null,
 deleted_at timestamptz not null default now(),
 primary key(user_id,quote_id)
);
alter table public.artessencia_quote_deletions_v1 enable row level security;
revoke all on public.artessencia_quote_deletions_v1 from public, anon, authenticated;
grant select, insert on public.artessencia_quote_deletions_v1 to authenticated;
create policy quote_deletion_read_own on public.artessencia_quote_deletions_v1 for select to authenticated using (user_id=(select auth.uid()));
create policy quote_deletion_insert_own on public.artessencia_quote_deletions_v1 for insert to authenticated with check (user_id=(select auth.uid()));
create or replace function public.artessencia_delete_quote_v1(p_quote_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null or p_quote_id is null then raise exception 'Authentication and quote UUID required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_quote_id::text,0));
 insert into public.artessencia_quote_deletions_v1(user_id,quote_id) values(v_user,p_quote_id) on conflict do nothing;
 delete from public.artessencia_v10_quote_items where user_id=v_user and quote_id=p_quote_id;
 delete from public.artessencia_v1_quotes where user_id=v_user and id=p_quote_id;
 if exists(select 1 from public.artessencia_v1_quotes where user_id=v_user and id=p_quote_id) or exists(select 1 from public.artessencia_v10_quote_items where user_id=v_user and quote_id=p_quote_id) then raise exception 'Quote deletion not verified'; end if;
 return true;
end $$;
revoke all on function public.artessencia_delete_quote_v1(uuid) from public, anon;
grant execute on function public.artessencia_delete_quote_v1(uuid) to authenticated;
create or replace function public.artessencia_guard_quote_write_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||':'||new.id::text,0));
 if exists(select 1 from public.artessencia_quote_deletions_v1 d where d.user_id=new.user_id and d.quote_id=new.id) then
   raise exception 'Quote has been deleted' using errcode='23514';
 end if;
 if coalesce(new.status,'Rascunho')='Rascunho'
    and new.client_id is null and coalesce(new.total,0)=0
    and coalesce(btrim(new.data->>'client'),'')=''
    and coalesce(btrim(new.data->>'contact'),'')=''
    and coalesce(btrim(new.data->>'email'),'')=''
    and coalesce(new.data->>'orderId','')=''
    and coalesce(new.data->>'eventRequestId','')=''
    and coalesce(new.data->>'depositPaid','0') in ('0','0.00','0.0')
    and coalesce(new.data->'paymentHistory','[]'::jsonb)='[]'::jsonb
    and new.data->'items'='[]'::jsonb
    and coalesce(btrim(new.data->>'code'),'')<>''
    and (select count(*) from unnest(array['category','price','cost','productionType','shopVisible','aprecoImportIdV1753']) as f(k) where new.data ? f.k)>=4 then
   raise exception 'Product-shaped payload is not a quote' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.artessencia_guard_quote_write_v1() from public, anon;
grant execute on function public.artessencia_guard_quote_write_v1() to authenticated;
create trigger artessencia_guard_quote_write_v1 before insert or update on public.artessencia_v1_quotes for each row execute function public.artessencia_guard_quote_write_v1();
-- Old installed versions still issue a direct DELETE. Record that deletion too.
create or replace function public.artessencia_record_quote_delete_v1()
returns trigger language plpgsql security invoker set search_path='' as $
begin
 insert into public.artessencia_quote_deletions_v1(user_id,quote_id)
 values(old.user_id,old.id) on conflict do nothing;
 return old;
end $;
revoke all on function public.artessencia_record_quote_delete_v1() from public, anon;
grant execute on function public.artessencia_record_quote_delete_v1() to authenticated;
create trigger artessencia_record_quote_delete_v1 before delete on public.artessencia_v1_quotes for each row execute function public.artessencia_record_quote_delete_v1();
commit;
