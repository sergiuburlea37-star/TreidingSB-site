-- 202607300006_fx_rates_eu_may2026_seed.sql
--
-- Ultimul blocaj pentru "Pondere initiala" a pozitiilor EU: 5 din cele 14
-- pozitii EU sunt in alta moneda decat EUR (baza portofoliului EU) - NOVN/
-- ABBN (CHF), INVE B (SEK), AAPL/GOOGL (USD) - si convert() din
-- api/account-portfolios.js returneaza null (nu o valoare inventata) cand
-- fx_rates nu are cursul necesar. Acest seed adauga exact acele 3 cursuri
-- (+ EUR/GBP, cerut explicit, desi nu e folosit de nicio pozitie EU in acest
-- moment) - istorice, la data fondarii portofoliului EU (18 mai 2026), NU
-- curente.
--
-- Sursa: BCE (Banca Centrala Europeana), fisierul oficial de referinta
-- eurofxref-hist-90d.xml:
--   https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml
-- Data 2026-05-18 confirmata prezenta in fisier la momentul redactarii.
-- Cursurile BCE sunt publicate ca "1 EUR = X" (moneda straina per 1 EUR) -
-- exact formatul cerut de coloanele tabelului fx_rates (`rate numeric --
-- 1 base_currency = rate * quote_currency`, vezi migrarea
-- 202607290001_member_portfolios.sql). NU a fost nevoie de nicio inversare:
-- base_currency = 'EUR' pe toate cele 4 randuri, quote_currency = moneda
-- straina, rate = cursul BCE exact asa cum e publicat. Verificat explicit
-- inainte de a scrie acest fisier - nu s-a presupus formula, s-a citit din
-- migrarea care defineste tabelul.
--
-- Cursuri (BCE, 18 mai 2026, 1 EUR = X):
--   EUR/CHF = 0.9144
--   EUR/SEK = 10.9465
--   EUR/USD = 1.1648
--   EUR/GBP = 0.8702
--
-- NU sunt cursuri live - source = 'manual' (la fel ca restul randurilor din
-- fx_rates; vezi coloana `source` si comentariul tabelului: "Curs manual
-- introdus de admin"). UI-ul (member-portfolios.js) nu foloseste aceste
-- cursuri pentru pretul curent / profitul curent - acelea raman "In
-- asteptarea datelor live" indiferent de continutul fx_rates, cat timp
-- price_source ramane 'manual' pe pozitii (vezi api/account-portfolios.js).
-- Cursurile de mai jos servesc STRICT la calculul "Pondere initiala" (suma
-- tranzactiilor BUY istorice, convertita in moneda de baza a portofoliului).
--
-- Idempotent: `on conflict (base_currency, quote_currency, as_of_date) do
-- update set rate = excluded.rate, source = excluded.source` - constrangerea
-- UNIQUE reala de pe fx_rates (vezi migrarea 202607290001). Foloseste
-- `do update` (nu `do nothing`) deliberat: daca acest seed e re-rulat cu o
-- valoare corectata pentru aceeasi data, corectia trebuie sa se aplice, nu
-- sa fie ignorata tacit.
--
-- Nu atinge nicio alta tabela, nu modifica pozitii/tranzactii/design. Nu
-- se aplica automat - fisier versionat, de rulat manual (Supabase SQL
-- Editor) DUPA validare locala si aprobare separata a proprietarului
-- (acelasi tipar ca toate migrarile/seed-urile anterioare din acest PR).

begin;

insert into public.fx_rates
  (base_currency, quote_currency, rate, as_of_date, source)
values
  ('EUR', 'CHF', 0.9144, '2026-05-18', 'manual'),
  ('EUR', 'SEK', 10.9465, '2026-05-18', 'manual'),
  ('EUR', 'USD', 1.1648, '2026-05-18', 'manual'),
  ('EUR', 'GBP', 0.8702, '2026-05-18', 'manual')
on conflict (base_currency, quote_currency, as_of_date) do update set
  rate = excluded.rate,
  source = excluded.source;

commit;
