-- 202608050008_portfolio_performance_history_seed.sql
--
-- Seed pentru public.portfolio_performance_history (seria pentru graficul
-- 1L/3L/1A/MAX din member-portfolios.js) - 22 instantanee saptamanale
-- validate (14 US + 8 EU). Sursa: registrul
-- TreidingSB_Portofolii_Istoric_Saptamanal_v2.xlsx, foaia Istoric_Saptamanal
-- (valori calculate prin formule, nu inventate; fiecare pret are
-- sursa/data/moneda documentate acolo, in Preturi_Istorice / Cursuri_FX_Istorice
-- / Surse_Audit).
--
-- PREREHIZITA: necesita supabase/seeds/202607290001_portfolios_metadata_seed.sql
-- (v5) deja aplicat manual in Supabase - randurile public.portfolios cu
-- code='US'/'EU' trebuie sa existe deja, pentru ca INSERT-ul de mai jos
-- foloseste `where p.code = v.portfolio_code` (nu UUID hardcodat, la fel ca
-- restul seed-urilor din acest proiect). Daca acel seed nu a fost inca
-- rulat, acest fisier se aplica FARA eroare dar NU insereaza niciun rand
-- (0 rows affected) - verifica explicit count(*) dupa rulare, nu doar
-- absenta erorii. Testat empiric mai jos (nota finala).
--
-- Deliberat EXCLUSE din acest prim import (4 din cele 26 de instantanee
-- calculate in registru), ca site-ul sa nu afiseze niciodata un NAV stiut
-- incomplet:
-- - EU 2026-05-22: pretul ALV neconfirmat la acea data
-- - EU 2026-06-19: pretul ASML neconfirmat la acea data
-- - EU 2026-06-26: pretul ASML neconfirmat la acea data
-- - EU 2026-07-31: pretul PRY neconfirmat la acea data
-- Se adauga separat, printr-un seed mic ulterior, imediat ce preturile
-- lipsa sunt confirmate (vezi Surse_Audit din registru pentru detalii).
--
-- INCLUS, dar cu o discrepanta semnalata pentru verificare manuala (NU
-- exclus - vezi raportul insotitor livrat separat): EU 2026-07-24 (PRY) -
-- valoare posibil atribuita unei date gresite in sursa; recomandat sa
-- confirmi manual acest pret inainte de a aplica acest seed, la fel cum ai
-- confirmat cursurile FX din PR #11.
--
-- capital_contributed = 10000 pe toate randurile (o singura contributie
-- initiala per portofoliu, fara depuneri/retrageri ulterioare pana la
-- 31.07.2026 - vezi portfolio_transactions din seed-ul v5). cumulative_return_pct
-- e CALCULAT la insert din (nav_value - capital_contributed) /
-- capital_contributed - randament money-weighted, exact cum e definit in
-- comentariul coloanei din migrarea 202607290001_member_portfolios.sql -
-- nu e retastat din Excel, ca sa nu poata diverge de nav_value.
--
-- Nu exista coloana pentru nota de sursa in schema reala
-- (portfolio_performance_history nu are source_note, spre deosebire de
-- foaia Istoric_Saptamanal din registru) - trasabilitatea completa
-- (pret/data/sursa/URL per instrument) ramane in registrul Excel insotitor,
-- nu se duplica aici.
--
-- Idempotent: `on conflict (portfolio_id, as_of_date) do update set
-- nav_value = excluded.nav_value, capital_contributed =
-- excluded.capital_contributed, cumulative_return_pct =
-- excluded.cumulative_return_pct, currency = excluded.currency`
-- (constrangerea UNIQUE reala de pe tabela, din migrarea 202607290001).
-- Foloseste `do update` (nu `do nothing`) deliberat, la fel ca seed-urile
-- FX din PR #11: daca acest seed e rulat din nou cu o valoare corectata
-- pentru aceeasi data, corectia trebuie sa se aplice, nu sa fie ignorata
-- tacit.
--
-- Nu atinge nicio alta tabela. Nu se aplica automat - fisier versionat, de
-- rulat manual (Supabase SQL Editor) DUPA aprobare separata a
-- proprietarului, la fel ca toate migrarile/seed-urile anterioare din
-- acest proiect.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase, PostgreSQL 16):
-- (a) rulat pe un schema fara randuri in portfolios -> 0 randuri inserate,
-- fara eroare, confirmand nota de mai sus; (b) rulat dupa inserarea
-- randurilor portfolios(US/EU) -> exact 22 randuri inserate (14 US + 8 EU),
-- cumulative_return_pct verificat manual pe 3 esantioane fata de valorile
-- din registru; (c) rulat a doua oara (idempotenta) -> tot 22 randuri, fara
-- duplicate, fara eroare (on conflict do update).

begin;

insert into public.portfolio_performance_history
(portfolio_id, as_of_date, nav_value, capital_contributed, cumulative_return_pct, currency)
select p.id, v.as_of_date, v.nav_value, v.capital_contributed,
round(((v.nav_value - v.capital_contributed) / v.capital_contributed) * 100, 4),
v.currency
from public.portfolios p
join (values
-- --- US (GBP, fondat 2026-05-07) - 14/14 instantanee, toate validate ---
('US'::text, '2026-05-07'::date, 10003.60::numeric, 10000::numeric, 'GBP'::text),
('US', '2026-05-08'::date, 9998.37::numeric, 10000::numeric, 'GBP'),
('US', '2026-05-15'::date, 10007.01::numeric, 10000::numeric, 'GBP'),
('US', '2026-05-22'::date, 10156.25::numeric, 10000::numeric, 'GBP'),
('US', '2026-05-29'::date, 10289.64::numeric, 10000::numeric, 'GBP'),
('US', '2026-06-05'::date, 10125.45::numeric, 10000::numeric, 'GBP'),
('US', '2026-06-12'::date, 10191.23::numeric, 10000::numeric, 'GBP'),
('US', '2026-06-19'::date, 10361.95::numeric, 10000::numeric, 'GBP'),
('US', '2026-06-26'::date, 10270.84::numeric, 10000::numeric, 'GBP'),
('US', '2026-07-03'::date, 10420.26::numeric, 10000::numeric, 'GBP'),
('US', '2026-07-10'::date, 10342.36::numeric, 10000::numeric, 'GBP'),
('US', '2026-07-17'::date, 10262.30::numeric, 10000::numeric, 'GBP'),
('US', '2026-07-24'::date, 10355.35::numeric, 10000::numeric, 'GBP'),
('US', '2026-07-31'::date, 10297.90::numeric, 10000::numeric, 'GBP'),
-- --- EU (EUR, fondat 2026-05-18) - 8/12 instantanee (4 excluse, vezi antet) ---
('EU', '2026-05-18'::date, 9999.52::numeric, 10000::numeric, 'EUR'),
('EU', '2026-05-29'::date, 10308.24::numeric, 10000::numeric, 'EUR'),
('EU', '2026-06-05'::date, 10344.81::numeric, 10000::numeric, 'EUR'),
('EU', '2026-06-12'::date, 10403.58::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-03'::date, 10604.89::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-10'::date, 10364.71::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-17'::date, 10311.44::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-24'::date, 10384.94::numeric, 10000::numeric, 'EUR') -- discrepanta semnalata, vezi antet
) as v(portfolio_code, as_of_date, nav_value, capital_contributed, currency)
on true
where p.code = v.portfolio_code
on conflict (portfolio_id, as_of_date) do update set
nav_value = excluded.nav_value,
capital_contributed = excluded.capital_contributed,
cumulative_return_pct = excluded.cumulative_return_pct,
currency = excluded.currency;

commit;
