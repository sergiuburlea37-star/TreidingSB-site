-- 202607290004_add_portfolio_cash_reserves.sql
--
-- Migrare aditiva, necesara pentru corectarea modelului contabil al
-- seed-ului v5 (portofolii US/EU). Adauga un tabel nou dedicat exclusiv
-- reprezentarii scopului numerarului nealocat inca unei pozitii (ex. "GBP
-- 800 rezervati pentru IWFV, in asteptarea unui pret"). NU modifica nicio
-- tabela existenta.
--
-- De ce e necesar (verificat inainte de a scrie aceasta migrare, nu presupus):
-- schema existenta are DOAR public.portfolio_positions (holdings cu pret) si
-- public.portfolio_transactions (miscari de cash: DEPOSIT/WITHDRAWAL/BUY/
-- SELL/FEE). Niciuna din cele doua nu poate reprezenta corect "o parte din
-- cash-ul disponibil e rezervata/etichetata pentru un scop anume, dar nu a
-- fost inca cheltuita" fara sa fie folosita gresit:
--  - ca pozitie (portfolio_positions) -> ar necesita un pret/cantitate
--    fictive pentru ceva ce nu e o detinere reala (interzis explicit);
--  - ca tranzactie (portfolio_transactions) -> o rezerva NU e o miscare de
--    cash (nu intra/iese bani), e doar o eticheta pe o parte din cash-ul
--    deja existent in cont; reprezentarea gresita anterioara (seed v4, ca
--    tranzactii DEPOSIT separate) ar fi falsificat istoricul contributiilor
--    reale de capital - de aceea aceasta migrare exista.
--
-- Tabel nou: public.portfolio_cash_reserves. Un rand = o "eticheta" pe o
-- suma din cash-ul portofoliului, cu scopul ei (categorie), eventual legata
-- de un ticker anume (daca/cand va deveni o pozitie cumparata). Suma
-- randurilor per portofoliu trebuie sa fie egala cu cash-ul calculat din
-- ledger (DEPOSIT + SELL + dividende - WITHDRAWAL - BUY - FEE) - o
-- reconciliere, nu o sursa suplimentara de bani (nu se aduna separat in
-- calculul NAV, vezi raportul insotitor pentru formula completa).
--
-- Testata local intr-un sandbox Postgres aruncat (nu Supabase), pe o copie
-- a schemei reale din Production - se aplica curat. NU se aplica automat
-- aici - ramane pe branch-ul Draft PR #9, necesita rulare manuala in
-- Supabase dupa aprobare separata (la fel ca migrarile anterioare).

begin;

create table public.portfolio_cash_reserves (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  category text not null,              -- ex: 'iwfv_reserved', 'spcx_reserved', 'cash_equivalent'
  amount numeric not null check (amount >= 0),
  currency text not null check (currency in ('GBP','EUR','USD','CHF','DKK','SEK')),
  reserved_for_ticker text,            -- nullable: ticker-ul instrumentului vizat (ex. 'IWFV'), null daca rezerva
                                        -- e generala (ex. buffer defensiv, nu vizeaza un instrument anume)
  status text not null default 'reserved' check (status in ('reserved','released')),
                                        -- 'reserved' = inca netransformata intr-o pozitie/cheltuita;
                                        -- 'released' = eliberata (fie s-a cumparat instrumentul via BUY separat,
                                        -- fie a fost realocata) - randul ramane pentru istoric, nu se sterge.
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, category)
);

comment on table public.portfolio_cash_reserves is
  'Etichete pe portiuni din cash-ul unui portofoliu, dupa scop (ex. rezervat pt. un instrument fara pret inca, sau buffer defensiv). Suma randurilor active (status=reserved) per portofoliu trebuie sa fie egala cu cash-ul calculat din portfolio_transactions (+ portfolio_dividends) - vezi formula NAV din raportul insotitor. Nu reprezinta miscari de cash (nu e un inlocuitor pentru portfolio_transactions) si nu se aduna separat in calculul NAV.';

alter table public.portfolio_cash_reserves enable row level security;

-- acelasi tipar ca la celelalte tabele: membri cu abonament activ -> doar
-- citire, si doar pt. portofolii publicate; admin -> tot.
create policy cash_reserves_active_read on public.portfolio_cash_reserves
  for select to authenticated
  using (
      public.has_active_subscription()
      and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.published)
    );

create policy cash_reserves_admin_all on public.portfolio_cash_reserves
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- GRANT explicit la nivel de tabel pentru authenticated - fara el, RLS nu
-- conteaza deloc (Postgres respinge accesul inainte sa evalueze vreo
-- policy) - exact bug-ul gasit si corectat in migrarea initiala a
-- schemei (202607290001_member_portfolios.sql), repetat aici din start
-- ca sa nu reapara. NU se acorda nimic catre `anon`.
grant select, insert, update, delete
  on public.portfolio_cash_reserves
  to authenticated;

grant all privileges
  on public.portfolio_cash_reserves
  to service_role;

commit;
