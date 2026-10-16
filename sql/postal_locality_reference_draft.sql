-- ArtEssencia: preparação isolada; NÃO executar em produção sem carregar e auditar a referência postal.
-- Uma correspondência postal deve ser única. Localidades sem correspondência confirmada são recusadas.
create table if not exists public.artessencia_postal_locality_reference (
  postal_code text primary key check (postal_code ~ '^[0-9]{4}-[0-9]{3}$'),
  locality_key text not null check (length(btrim(locality_key)) > 0),
  source_name text not null,
  source_version text not null,
  verified_at timestamptz not null default now()
);
alter table public.artessencia_postal_locality_reference enable row level security;
revoke all on public.artessencia_postal_locality_reference from public, anon, authenticated;
create index if not exists artessencia_postal_locality_reference_locality_idx
  on public.artessencia_postal_locality_reference(locality_key);

-- A importação da fonte deve rejeitar CP duplicados/ambíguos, não escolher arbitrariamente.
-- Nunca inferir localidade pelo prefixo de quatro dígitos.
-- A função abaixo é um verificador interno; a integração deve ser feita na validação
-- transacional de store_submit_order_v2 e no cálculo de portes existente.
create or replace function public.artessencia_postal_matches_locality_v1(
  p_locality text, p_postal_code text
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.artessencia_postal_locality_reference r
    where r.postal_code = btrim(coalesce(p_postal_code,''))
      and r.locality_key = lower(btrim(coalesce(p_locality,'')))
      and btrim(coalesce(p_postal_code,'')) ~ '^[0-9]{4}-[0-9]{3}$'
  );
$$;
revoke all on function public.artessencia_postal_matches_locality_v1(text,text)
  from public, anon, authenticated;
-- TESTES OBRIGATÓRIOS antes da integração: CP correto, CP de outra localidade,
-- CP desconhecido, localidade inativa, duplicados na fonte, pedidos concorrentes,
-- e tentativas diretas de chamar store_submit_order_v2.
