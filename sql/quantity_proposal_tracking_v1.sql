-- ArtEssencia — gestão comercial das propostas da Precificação em Quantidade.
-- PENDENTE DE APLICAÇÃO: não publicar a interface V2.5 sem a migração verificada.
-- SQL de produção: alteração de política + tabela isolada de eventos; sem alteração
-- dos registos de clientes, encomendas, stock ou simulações já guardadas.

-- A política anterior consulta recursivamente a própria tabela durante INSERT.
-- Mantemos o controlo owner; a origem é validada por trigger invoker.
alter policy quantity_simulations_owner_insert_v1
on public.artessencia_quantity_simulations_v1
with check (
  user_id = (select auth.uid())
  and (select public.artessencia_is_owner_v1())
  and (
    (kind = 'simulation' and source_simulation_id is null)
    or (kind = 'proposal' and source_simulation_id is not null)
  )
);

-- Um orçamento só pode referir uma simulação da mesma conta.
create function public.ae_quantity_proposal_link_guard_v1()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.kind = 'proposal' then
    if new.source_simulation_id is null or not exists (
      select 1 from public.artessencia_quantity_simulations_v1 as source
      where source.simulation_id = new.source_simulation_id
        and source.user_id = new.user_id
        and source.kind = 'simulation'
        and source.source_simulation_id is null
    ) then
      raise exception 'A proposta necessita de uma simulação própria já guardada.';
    end if;
  elsif new.kind = 'simulation' and new.source_simulation_id is not null then
    raise exception 'Uma simulação não pode referir outra simulação.';
  end if;
  return new;
end;
$$;
revoke all on function public.ae_quantity_proposal_link_guard_v1() from public, anon;
grant execute on function public.ae_quantity_proposal_link_guard_v1() to authenticated, service_role;
create trigger ae_quantity_proposal_link_guard_insert_v1
before insert on public.artessencia_quantity_simulations_v1
for each row execute function public.ae_quantity_proposal_link_guard_v1();

-- Eventos de decisão são apenas adicionados: INSERT/SELECT pelo proprietário.
create table if not exists public.artessencia_quantity_proposal_events_v1 (
  event_id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.artessencia_quantity_simulations_v1(simulation_id) on delete restrict,
  user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('sent','accepted','declined','cancelled')),
  channel text not null default 'other' check (channel in ('whatsapp','email','phone','in_person','other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default clock_timestamp()
);
create unique index if not exists ae_quantity_proposal_events_once_v1
  on public.artessencia_quantity_proposal_events_v1(proposal_id,event_type);
create index if not exists ae_quantity_proposal_events_owner_created_v1
  on public.artessencia_quantity_proposal_events_v1(user_id,created_at desc);
alter table public.artessencia_quantity_proposal_events_v1 enable row level security;
revoke all on public.artessencia_quantity_proposal_events_v1 from public, anon, authenticated;
grant select on public.artessencia_quantity_proposal_events_v1 to authenticated;
grant insert (proposal_id,user_id,event_type,channel,note)
  on public.artessencia_quantity_proposal_events_v1 to authenticated;
grant all on public.artessencia_quantity_proposal_events_v1 to service_role;
create policy ae_quantity_proposal_events_owner_read_v1
on public.artessencia_quantity_proposal_events_v1 for select to authenticated
using (user_id=(select auth.uid()) and (select public.artessencia_is_owner_v1()));
create policy ae_quantity_proposal_events_owner_insert_v1
on public.artessencia_quantity_proposal_events_v1 for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (select public.artessencia_is_owner_v1())
  and exists (
    select 1 from public.artessencia_quantity_simulations_v1 as proposal
    where proposal.simulation_id=artessencia_quantity_proposal_events_v1.proposal_id
      and proposal.user_id=(select auth.uid())
      and proposal.kind='proposal'
  )
);

-- Validação no servidor: bloquear decisões finais concorrentes e propostas
-- expiradas, mesmo que o telemóvel tenha um relógio incorreto.
create function public.ae_quantity_proposal_event_transition_v1()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  last_event text;
  expires_on text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.proposal_id::text,0));
  select ev.event_type into last_event
  from public.artessencia_quantity_proposal_events_v1 as ev
  where ev.proposal_id=new.proposal_id and ev.user_id=new.user_id
  order by ev.created_at desc,ev.event_id desc
  limit 1;

  if last_event is null then
    if new.event_type not in ('sent','cancelled') then
      raise exception 'A proposta tem de ser marcada como enviada antes da decisão.';
    end if;
  elsif last_event = 'sent' then
    if new.event_type not in ('accepted','declined','cancelled') then
      raise exception 'Transição comercial inválida.';
    end if;
  else
    raise exception 'Esta proposta já tem uma decisão final.';
  end if;

  if new.event_type in ('sent','accepted') then
    select proposal.payload #>> '{customerOffer,validUntil}' into expires_on
    from public.artessencia_quantity_simulations_v1 as proposal
    where proposal.simulation_id=new.proposal_id
      and proposal.user_id=new.user_id and proposal.kind='proposal';
    if expires_on is not null and expires_on <> '' then
      if expires_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Formato de validade comercial inválido.';
      end if;
      if expires_on::date < (clock_timestamp() at time zone 'Europe/Lisbon')::date then
        raise exception 'Uma proposta expirada não pode ser enviada ou aceite.';
      end if;
    end if;
  end if;

  if new.event_type in ('sent','accepted','declined')
     and char_length(pg_catalog.btrim(new.note)) < 5 then
    raise exception 'Indica a evidência da decisão comercial (mínimo 5 caracteres).';
  end if;

  -- Apurar a hora real após obter o bloqueio, e não a hora de início
  -- de uma transação concorrente que tenha esperado por este registo.
  new.created_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.ae_quantity_proposal_event_transition_v1() from public, anon;
grant execute on function public.ae_quantity_proposal_event_transition_v1() to authenticated, service_role;
create trigger ae_quantity_proposal_event_transition_insert_v1
before insert on public.artessencia_quantity_proposal_events_v1
for each row execute function public.ae_quantity_proposal_event_transition_v1();

-- Após aplicação autorizada, verificar RLS, GRANTs, triggers, histórico,
-- transições, fuso Europe/Lisbon e a ausência de UPDATE/DELETE autenticados.
