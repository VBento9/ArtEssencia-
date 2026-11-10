-- Field-scoped append-only guard. No changes to production RPCs, RLS or existing rows.
create or replace function public.artessencia_guard_manual_fragrance_history_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
 previous jsonb := old.data #> '{settings,manualFragranceLibraryV1}';
 incoming jsonb := new.data #> '{settings,manualFragranceLibraryV1}';
 item jsonb; replacement jsonb; history jsonb; candidate jsonb;
begin
 if previous is null or previous = '[]'::jsonb then return new; end if;
 if jsonb_typeof(previous) <> 'array' or jsonb_typeof(incoming) is distinct from 'array' then
  raise exception 'manual_fragrance_history_conflict: historical library cannot be removed' using errcode='40001';
 end if;
 if exists(select 1 from jsonb_array_elements(incoming) r group by r->>'id' having count(*)>1) then
  raise exception 'manual_fragrance_history_conflict: duplicate fragrance' using errcode='40001';
 end if;
 for item in select value from jsonb_array_elements(previous) loop
  select value into replacement from jsonb_array_elements(incoming) where value->>'id'=item->>'id';
  if replacement is null then raise exception 'manual_fragrance_history_conflict: fragrance missing' using errcode='40001'; end if;
  history := coalesce(item->'movements','[]'::jsonb);
  candidate := coalesce(replacement->'movements','[]'::jsonb);
  if jsonb_typeof(candidate) <> 'array' or jsonb_typeof(history) <> 'array' then
   raise exception 'manual_fragrance_history_conflict: invalid history' using errcode='40001';
  end if;
  if jsonb_array_length(candidate)<jsonb_array_length(history) or exists(
   select 1 from jsonb_array_elements(history) with ordinality h(value,n)
   where h.value is distinct from candidate->(h.n::integer-1)
  ) then raise exception 'manual_fragrance_history_conflict: immutable movement changed' using errcode='40001'; end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.artessencia_guard_manual_fragrance_history_v1() from public,anon,authenticated;
create trigger artessencia_manual_fragrance_history_guard_v1
before update of data on public.artessencia_v1_state
for each row execute function public.artessencia_guard_manual_fragrance_history_v1();
