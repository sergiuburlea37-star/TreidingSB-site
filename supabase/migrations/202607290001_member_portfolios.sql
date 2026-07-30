-- 202607290001_member_portfolios.sql
-- Schema pentru mutarea portofoliilor US/EU din HTML public in Cabinetul
-- membrului, cu acces controlat prin RLS (nu doar prin cod).
--
-- NU se executa automat. Fisier versionat, de revizuit si rulat manual
-- (Supabase SQL Editor sau `supabase db push`) DOAR dupa aprobare explicita.
-- Exclusiv aditiv: nu modifica nicio tabela/policy/functie existenta
-- (public.profiles, public.subscriptions, public.trading_ideas, public.reports
-- raman neatinse). Rollback = drop pe obiectele de mai jos, fara impact pe
-- datele existente.
--
-- Verificarea accesului (cerinta explicita a proiectului) se face server-side
-- folosind exact ce exista deja si e verificat in productie:
--   - sesiune valida            -> access.authenticated (api/_lib/access.js)
--   - rolul                     -> public.profiles.role ('free' | 'member' | 'admin')
--   - subscription_status       -> public.subscriptions.status = 'active'
--   - subscription_expires_at   -> public.subscriptions.expires_at > now()
-- Functiile public.is_admin() si public.has_active_subscription(), definite in
-- supabase/migrations/202607220001_secure_premium_access.sql, incapsuleaza deja
-- exact aceasta logica si sunt reutilizate neschimbate mai jos.
--
-- Actualizare 2026-07-29 (preflight): adaugate GRANT-urile explicite pentru
-- rolul `authenticated` pe cele 6 tabele noi (lipseau in versiunea initiala -
-- fara ele, RLS nu conta deloc, pentru ca Postgres respinge accesul inainte
-- sa evalueze vreo policy; verificat empiric intr-un sandbox local, separat
-- de Supabase real). Migrarea e acum si impachetata explicit in begin/commit,
-- ca aplicarea sa fie mereu atomica, indiferent de unealta care o ruleaza.

begin;

-- ---------------------------------------------------------------------------
-- 1. Portofolii (US / EU)
-- ---------------------------------------------------------------------------
create table public.portfolios (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (code in ('US','EU')),
    name text not null,
    base_currency text not null check (base_currency in ('GBP','EUR','USD')),
    founded_date date,
    initial_capital numeric not null default 0,
    target_return_text text,
    risk_level text,
    description text,
    -- nume/descriere localizate, editabile din Admin; cheie = cod limba
  -- (ro/en/ru/uk/pl), valoare = text. Optional - cardul public poate cadea
  -- pe `name`/`description` daca lipseste traducerea pentru limba curenta.
  name_i18n jsonb not null default '{}'::jsonb,
    description_i18n jsonb not null default '{}'::jsonb,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

comment on table public.portfolios is
  'Metadate agregate per portofoliu (US/EU). Coloanele agregate (nu holdings) sunt expuse public prin view-ul portfolios_public.';

-- ---------------------------------------------------------------------------
-- 2. Pozitii active (holdings) - informatia "premium" propriu-zisa
-- ---------------------------------------------------------------------------
create table public.portfolio_positions (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    position_no int,
    ticker text not null,
    name text not null,
    category text,               -- ex: 'ETF', 'Actiune'
  sector_or_market text,       -- ex: 'Tehnologie', 'Xetra Frankfurt'
  instrument_currency text not null check (instrument_currency in ('GBP','EUR','USD','CHF')),
    quantity numeric not null default 0,
    avg_price numeric not null default 0,     -- pret mediu de achizitie, in instrument_currency
  current_price numeric,                    -- ultimul pret cunoscut, in instrument_currency
  price_updated_at timestamptz,             -- ora ultimei actualizari de pret (afisata explicit in UI)
  price_source text default 'manual' check (price_source in ('manual','delayed_feed','live_feed')),
    risk_level text,
    group_label text,             -- eticheta de grup pt. tabel (ex: "CRESTERE - Actiuni individuale (25%)")
  active boolean not null default true,     -- false = pozitie inchisa (istoric, nu mai apare ca activa)
  sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

comment on column public.portfolio_positions.price_source is
  'manual = pret introdus de admin (starea curenta, fara integrare live). delayed_feed / live_feed rezervate pentru integrarea viitoare cu un furnizor de preturi (Etapa 4 - necesita aprobare separata inainte de a fi folosite).';

-- ---------------------------------------------------------------------------
-- 3. Tranzactii (BUY/SELL/FEE/DEPOSIT/WITHDRAWAL) - baza calculului de performanta
-- ---------------------------------------------------------------------------
create table public.portfolio_transactions (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    position_id uuid references public.portfolio_positions(id) on delete set null,
    ticker text,                              -- redundant intentionat, ca istoricul sa ramana lizibil daca pozitia e stearsa
  type text not null check (type in ('BUY','SELL','FEE','DEPOSIT','WITHDRAWAL')),
    quantity numeric,                         -- null pt. FEE/DEPOSIT/WITHDRAWAL
  price numeric,                            -- null pt. FEE/DEPOSIT/WITHDRAWAL
  amount numeric not null,                  -- valoare neta a miscarii, in currency (mereu pozitiv, sensul dat de `type`)
  fee_amount numeric not null default 0,
    currency text not null check (currency in ('GBP','EUR','USD','CHF')),
    executed_at timestamptz not null default now(),
    note text,
    created_at timestamptz not null default now()
  );

-- ---------------------------------------------------------------------------
-- 4. Dividende (eveniment de cash distinct, cerut explicit ca tabela separata)
-- ---------------------------------------------------------------------------
create table public.portfolio_dividends (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    position_id uuid references public.portfolio_positions(id) on delete set null,
    ticker text not null,
    amount numeric not null,
    currency text not null check (currency in ('GBP','EUR','USD','CHF')),
    ex_date date,
    pay_date date not null,
    note text,
    created_at timestamptz not null default now()
  );

-- ---------------------------------------------------------------------------
-- 5. Istoric de performanta (seria pt. graficul 1L / 3L / 1A / MAX)
-- ---------------------------------------------------------------------------
create table public.portfolio_performance_history (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    as_of_date date not null,
    nav_value numeric not null,               -- valoarea totala a portofoliului la acea data, in base_currency
  capital_contributed numeric not null,     -- capital net depus pana la acea data (depozite - retrageri), in base_currency
  cumulative_return_pct numeric,            -- randament cumulat %, calculat si stocat (nu doar derivat din 2 preturi - vezi nota de mai jos)
  currency text not null check (currency in ('GBP','EUR','USD')),
    created_at timestamptz not null default now(),
    unique (portfolio_id, as_of_date)
  );

comment on table public.portfolio_performance_history is
  'Instantanee periodice, nu doar diferenta intre 2 preturi: nav_value reflecta pozitii + numerar + dividende reinvestite/incasate, iar cumulative_return_pct e calculat tinand cont de capital_contributed (randament money-weighted, nu simpla variatie de pret).';

-- ---------------------------------------------------------------------------
-- 6. Curs valutar (conversie GBP/EUR/USD/CHF) - intretinut manual de admin,
--    pana la aprobarea unui furnizor live (Etapa 4).
-- ---------------------------------------------------------------------------
create table public.fx_rates (
    id uuid primary key default gen_random_uuid(),
    base_currency text not null check (base_currency in ('GBP','EUR','USD','CHF')),
    quote_currency text not null check (quote_currency in ('GBP','EUR','USD','CHF')),
    rate numeric not null,                    -- 1 base_currency = rate * quote_currency
  as_of_date date not null default current_date,
    source text not null default 'manual' check (source in ('manual','live_feed')),
    created_at timestamptz not null default now(),
    unique (base_currency, quote_currency, as_of_date)
  );

comment on table public.fx_rates is
  'Curs manual introdus de admin. Conversia intre instrument_currency si portfolios.base_currency se face in API cu cel mai recent curs <= data ceruta. Sursa live_feed rezervata pt. integrare viitoare (necesita aprobare separata).';

-- ---------------------------------------------------------------------------
-- Vedere publica: DOAR coloane agregate, niciodata holdings/tranzactii/pozitii.
-- Aceasta e sursa pentru cardul de prezentare de pe pagina publica.
-- ---------------------------------------------------------------------------
create view public.portfolios_public as
  select id, code, name, name_i18n, base_currency, founded_date,
         initial_capital, target_return_text, risk_level,
         description, description_i18n
  from public.portfolios
  where published;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.portfolios enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.portfolio_dividends enable row level security;
alter table public.portfolio_performance_history enable row level security;
alter table public.fx_rates enable row level security;

-- portofolii: membri activi -> doar citire (portofolii publicate); admin -> tot
create policy portfolios_active_read on public.portfolios
  for select to authenticated
  using (published and public.has_active_subscription());

create policy portfolios_admin_all on public.portfolios
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- pozitii: acelasi tipar, verificat prin portofoliul parinte
create policy positions_active_read on public.portfolio_positions
  for select to authenticated
  using (
      public.has_active_subscription()
      and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.published)
    );

create policy positions_admin_all on public.portfolio_positions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- tranzactii
create policy transactions_active_read on public.portfolio_transactions
  for select to authenticated
  using (
      public.has_active_subscription()
      and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.published)
    );

create policy transactions_admin_all on public.portfolio_transactions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- dividende
create policy dividends_active_read on public.portfolio_dividends
  for select to authenticated
  using (
      public.has_active_subscription()
      and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.published)
    );

create policy dividends_admin_all on public.portfolio_dividends
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- istoric performanta
create policy performance_active_read on public.portfolio_performance_history
  for select to authenticated
  using (
      public.has_active_subscription()
      and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.published)
    );

create policy performance_admin_all on public.portfolio_performance_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- curs valutar: nu e "premium" per se, dar tot userul autentificat cu abonament
-- activ il poate citi (necesar pt. afisarea corecta a conversiei), doar adminul
-- il modifica
create policy fx_rates_active_read on public.fx_rates
  for select to authenticated
  using (public.has_active_subscription());

create policy fx_rates_admin_all on public.fx_rates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Vizitatori neautentificati si utilizatori "free"/expirati: nicio policy nu li
-- se aplica pe tabelele de mai sus -> RLS blocheaza implicit orice SELECT.
-- Singurul acces public este prin view-ul agregat de mai jos.
grant select on public.portfolios_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Acces de baza (nivel tabel) pentru authenticated - RLS de mai sus decide CE
-- randuri vede fiecare, dar fara acest GRANT niciun rand nu e vizibil, nici
-- macar pentru admin/membru activ (gasit si verificat empiric in preflight-ul
-- din 2026-07-29, intr-un sandbox Postgres local, separat de Supabase real).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.portfolios, public.portfolio_positions, public.portfolio_transactions,
     public.portfolio_dividends, public.portfolio_performance_history, public.fx_rates
  to authenticated;

-- Recomandat, pentru claritate si consecventa cu report_downloads/newsletter_subscribers
-- (service_role are probabil deja acces implicit la nivel de platforma Supabase,
-- dar il facem explicit ca sa nu depindem de acea presupunere):
grant all privileges
  on public.portfolios, public.portfolio_positions, public.portfolio_transactions,
     public.portfolio_dividends, public.portfolio_performance_history, public.fx_rates
  to service_role;

commit;

-- ---------------------------------------------------------------------------
-- Backfill: exact datele deja publice azi in index.html, ca sursa noua sa
-- porneasca identic cu ce vede vizitatorul acum (fara regres de continut).
-- A completa manual in Supabase SQL Editor / Admin, DUPA aprobarea rularii
-- acestei migrari - NU face parte din migrarea automata.
-- ---------------------------------------------------------------------------
