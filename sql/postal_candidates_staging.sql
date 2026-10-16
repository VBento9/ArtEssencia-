-- ArtEssencia postal staging (REVIEW ONLY; DO NOT RUN IN PRODUCTION).
-- Source: postal_candidates_all_portugal.csv; historic date not verified.
-- This staging schema deliberately allows multiple localities for one CP7.
-- It does NOT change live delivery calculation or customer orders.
create schema if not exists artessencia_postal_staging;
create table if not exists artessencia_postal_staging.candidates (
  postal_code text not null check (postal_code ~ '^[0-9]{4}-[0-9]{3}$'),
  locality text not null,
  municipality text not null,
  source_name text not null,
  review_status text not null default 'candidate_review'
    check (review_status in ('candidate_review','ambiguous','approved','rejected')),
  imported_at timestamptz not null default now(),
  primary key (postal_code, locality, municipality)
);
create index if not exists candidates_locality_idx
  on artessencia_postal_staging.candidates (lower(locality),lower(municipality));
revoke all on schema artessencia_postal_staging from public, anon, authenticated;
revoke all on all tables in schema artessencia_postal_staging from public, anon, authenticated;
alter table artessencia_postal_staging.candidates enable row level security;
-- CSV import requires privileged maintenance access after source verification.
-- Never promote ambiguous CP7 values to the live one-to-one reference table.
