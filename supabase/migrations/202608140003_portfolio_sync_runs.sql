-- 202608140003_portfolio_sync_runs.sql
--
-- Etapa 4 (integrare EODHD Live Delayed): tabel de audit pentru fiecare
-- rulare a sincronizarii de preturi (api/cron/sync-portfolio-prices.js),
-- indiferent daca a publicat sau nu un snapshot. Scop unic: sa existe o
-- sursa interogabila din care api/account-portfolios.js poate citi
-- rezultatul ULTIMEI rulari, pentru banner-ul "sincronizare partiala" din
-- UI (cerinta proiectului) - fara acest tabel, UI-ul ar putea doar deduce
-- euristic o problema din varsta preturilor, ceea ce ar confunda "piata e
-- inchisa" cu "sync-ul a esuat partial", doua situatii diferite.
--
-- Continutul nu e "premium" per se (nu contine holdings/tranzactii), dar
-- api/account-portfolios.js (rulat cu clientul legat de tokenul membrului,
-- NU cu service_role - vezi header-ul acelui fisier) are nevoie sa poata
-- CITI ultimul rand ca sa populeze lastSyncStatus pentru banner-ul de
-- sincronizare partiala vazut de ORICE membru cu abonament activ, nu doar
-- de admin - de aceea policy-ul de citire de mai jos foloseste
-- has_active_subscription(), la fel ca fx_rates (alt tabel "de suport",
-- neportofoliu-specific, citibil de orice membru activ).
--
-- Scris exclusiv de public.apply_portfolio_price_snapshot() (vezi migrarea
-- urmatoare) SAU direct de api/cron/sync-portfolio-prices.js prin
-- getSupabaseAdmin() (pt. rezultatele 'partial'/'fetch_failed', decise
-- INAINTE de a apela RPC-ul) - ambele cai folosesc service_role, de aceea
-- nu exista nicio policy de INSERT/UPDATE/DELETE pentru authenticated,
-- nici macar pentru admin.
--
-- Aditiva. NU se executa automat. Rulare manuala dupa aprobare.

begin;

create table public.portfolio_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  applied boolean not null,
  reason text,                 -- ok/partial/locked/fetch_failed/quota_*/state_changed/server_error
  problems jsonb not null default '[]'::jsonb,
    -- listă de {ticker, portfolio, status} pentru pozitiile care au cauzat
    -- 'partial' (missing/stale/future/unmapped) - vezi api/cron/sync-portfolio-prices.js
  provider_call_units int not null default 0 check (provider_call_units >= 0),
  provider_symbols_requested int not null default 0 check (provider_symbols_requested >= 0),
  quota_limit int check (quota_limit > 0),
  quota_projected int check (quota_projected >= 0),
  created_at timestamptz not null default now()
);

create table public.portfolio_sync_lease (
  lease_name text primary key,
  owner uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > acquired_at)
);

alter table public.portfolio_sync_lease enable row level security;
revoke all on public.portfolio_sync_lease from public, anon, authenticated;
grant all privileges on public.portfolio_sync_lease to service_role;

create or replace function public.acquire_portfolio_sync_lease(p_owner uuid, p_ttl_seconds int default 180)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lease_row public.portfolio_sync_lease%rowtype;
begin
  if p_owner is null or p_ttl_seconds < 30 or p_ttl_seconds > 900 then
    raise exception 'invalid sync lease parameters';
  end if;

  insert into public.portfolio_sync_lease (lease_name, owner, acquired_at, expires_at)
  values ('portfolio_price_sync', p_owner, clock_timestamp(), clock_timestamp() + make_interval(secs => p_ttl_seconds))
  on conflict (lease_name) do update
    set owner = excluded.owner,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
    where public.portfolio_sync_lease.expires_at <= clock_timestamp()
  returning * into lease_row;

  return jsonb_build_object(
    'acquired', lease_row.owner = p_owner,
    'expires_at', lease_row.expires_at
  );
end;
$$;

create or replace function public.release_portfolio_sync_lease(p_owner uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  delete from public.portfolio_sync_lease
  where lease_name = 'portfolio_price_sync' and owner = p_owner;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.acquire_portfolio_sync_lease(uuid, int) from public, anon, authenticated;
revoke all on function public.release_portfolio_sync_lease(uuid) from public, anon, authenticated;
grant execute on function public.acquire_portfolio_sync_lease(uuid, int) to service_role;
grant execute on function public.release_portfolio_sync_lease(uuid) to service_role;

comment on table public.portfolio_sync_runs is
  'Audit al fiecarei rulari a sincronizarii de preturi EODHD (aplicata sau nu). Scris exclusiv prin service_role. Citibil de orice membru cu abonament activ (RLS) - api/account-portfolios.js citeste ultimul rand pentru lastSyncStatus; frontend-ul expune doar campul derivat, nu tabela bruta.';

alter table public.portfolio_sync_runs enable row level security;

-- Orice membru cu abonament activ poate citi (are nevoie de asta pentru
-- banner-ul de sincronizare partiala) - admin poate citi oricum, tot prin
-- has_active_subscription() sau is_admin(). Niciun INSERT/UPDATE/DELETE
-- prin RLS pentru nimeni altcineva decat service_role.
create policy sync_runs_active_read on public.portfolio_sync_runs
  for select to authenticated
  using (public.has_active_subscription() or public.is_admin());

grant select on public.portfolio_sync_runs to authenticated;

grant all privileges on public.portfolio_sync_runs to service_role;

-- Acelasi fix de securitate aplicat celorlalte tabele din familia
-- portofoliilor (vezi 202607300005_revoke_unsafe_portfolio_privileges.sql) -
-- REFERENCES/TRIGGER/TRUNCATE nu sunt acoperite de RLS si Supabase le
-- acorda implicit; revocate explicit de la inceput, ca sa nu mai fie nevoie
-- de o migrare corectiva separata ca in cazul tabelelor initiale.
revoke truncate, references, trigger on public.portfolio_sync_runs from anon;
revoke truncate, references, trigger on public.portfolio_sync_runs from authenticated;
revoke all on public.portfolio_sync_runs from public;

commit;
