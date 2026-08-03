-- 202607300007_fx_rates_us_may2026_seed.sql
--
-- NEEXECUTAT. Pregatit doar la cerere explicita, pentru aprobare separata
-- inainte de a fi rulat manual in Supabase SQL Editor. Nu face parte din
-- PR #11 si nu a fost aplicat automat.
--
-- Motiv: convert() din api/account-portfolios.js (fix triangulare EUR,
-- PR #11) foloseste in acest moment DOAR cursurile existente in fx_rates,
-- toate datate 2026-05-18 (data fondarii portofoliului EU). Portofoliul US
-- a fost insa fondat la 2026-05-07 (vezi
-- supabase/seeds/202607290001_portfolios_metadata_seed.sql, founded_date
-- 'US' = '2026-05-07'). Triangularea EUR/USD->EUR/GBP folosind cursuri din
-- 18 mai pentru un portofoliu fondat pe 7 mai produce o pondere initiala
-- reala, dar NU identica cu tintele aprobate anterior (25/10/10/7/7.5/7.5%
-- pt. IWDA/VUKE/EIMI/WSML/AAPL/RR.) - vezi raportul PR #11 pentru cifrele
-- exacte obtinute cu cursul de 18 mai (25.5/10.0/10.2/7.1/7.6/7.5%).
--
-- Acest seed adauga exact cursurile care lipsesc pentru 2026-05-07: cele
-- doua perechi necesare triangularii USD->GBP prin EUR pentru pozitiile US
-- in USD (IWDA, EIMI, WSML, AAPL). VUKE si RR. sunt deja in GBP (moneda de
-- baza a portofoliului US) si nu au nevoie de conversie.
--
-- Sursa: BCE (Banca Centrala Europeana), cursuri oficiale de referinta
-- pentru 2026-05-07, confirmate prin Frankfurter API
-- (https://frankfurter.dev/ - wrapper public documentat explicit ca
-- sursandu-si datele din cursurile de referinta ECB):
--   https://api.frankfurter.dev/v1/2026-05-07?from=EUR&to=USD,GBP
-- Verificat si prin intervalul 2026-05-04..2026-05-08 pentru consistenta
-- (5 zile lucratoare consecutive, fara gap-uri neasteptate):
--   2026-05-04: USD 1.1700 / GBP 0.86358
--   2026-05-05: USD 1.1686 / GBP 0.86343
--   2026-05-06: USD 1.1762 / GBP 0.86370
--   2026-05-07: USD 1.1770 / GBP 0.86410   <- randul folosit in acest seed
--   2026-05-08: USD 1.1761 / GBP 0.86410
--
-- Cursuri (BCE, 7 mai 2026, 1 EUR = X):
--   EUR/USD = 1.1770
--   EUR/GBP = 0.8641
--
-- Format identic cu seed-ul deja mergeuit
-- (202607300006_fx_rates_eu_may2026_seed.sql): base_currency = 'EUR' pe
-- ambele randuri, quote_currency = moneda straina, rate = cursul BCE exact
-- asa cum e publicat (1 EUR = rate * quote_currency), source = 'manual'.
--
-- NU sunt cursuri live. NU sunt folosite pentru pretul curent / profitul
-- curent - acelea raman "In asteptarea datelor live" indiferent de
-- continutul fx_rates, cat timp price_source ramane 'manual' pe pozitii.
-- Servesc STRICT recalcularii "Ponderii initiale" a portofoliului US la
-- cursul corect pentru data lui de fondare.
--
-- Idempotent: `on conflict (base_currency, quote_currency, as_of_date) do
-- update set rate = excluded.rate, source = excluded.source` - aceeasi
-- constrangere UNIQUE ca in seed-ul precedent.
--
-- Nu atinge nicio alta tabela, nu modifica pozitii/tranzactii/design.

begin;

insert into public.fx_rates
  (base_currency, quote_currency, rate, as_of_date, source)
values
  ('EUR', 'USD', 1.1770, '2026-05-07', 'manual'),
  ('EUR', 'GBP', 0.8641, '2026-05-07', 'manual')
on conflict (base_currency, quote_currency, as_of_date) do update set
  rate = excluded.rate,
  source = excluded.source;

commit;
