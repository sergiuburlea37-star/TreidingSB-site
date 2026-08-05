-- 202608050008_portfolio_performance_history_seed.sql
--
-- Seed pentru public.portfolio_performance_history (seria pentru graficul
-- 1L/3L/1A/MAX din member-portfolios.js) - 21 instantanee saptamanale
-- validate (14 US + 7 EU). Sursa: registrul
-- TreidingSB_Portofolii_Istoric_Saptamanal_v2.xlsx, foaia Istoric_Saptamanal
-- (valori calculate prin formule, nu inventate; fiecare pret are
-- sursa/data/moneda documentate acolo, in Preturi_Istorice / Cursuri_FX_Istorice
-- / Surse_Audit).
--
-- Actualizare 2026-08-05 (revizuire cerere explicita): fata de versiunea
-- initiala a acestui fisier (22 randuri), EU 2026-07-24 (PRY) a fost MUTAT
-- in lista de excluderi. Motiv: Preturi_Istorice avea acel rand marcat
-- "OK" (nu "LIPSA"), dar Surse_Audit (randul cu PRY/2026-07-24) semnaleaza
-- o discrepanta de atribuire a datei gasita la verificarea incrucisata:
-- TipRanks atribuie explicit valoarea 126.90 EUR datei de 2026-07-27 (NU
-- 2026-07-24), ceea ce ar plasa inchiderea reala din 24.07 mai aproape de
-- ~131.70-131.90 EUR (inferat, NU confirmat direct de nicio sursa). Nicio
-- sursa nu afirma explicit "PRY a inchis la X EUR pe 24.07.2026" - de
-- aceea, desi are un pret cu sursa (StockAnalysis.com), acel pret nu poate
-- fi considerat suficient de sigur pentru un NAV publicat pe site. Ramane
-- exclus pana la o confirmare directa, separata.
--
-- PREREHIZITA: necesita supabase/seeds/202607290001_portfolios_metadata_seed.sql
-- (v5) deja aplicat manual in Supabase - randurile public.portfolios cu
-- code='US'/'EU' trebuie sa existe deja. Verificat explicit mai jos, INAINTE
-- de insert: daca oricare din cele doua portofolii lipseste, scriptul se
-- opreste cu eroare (RAISE EXCEPTION) si NU insereaza nimic - nu mai poate
-- "reusi" silentios cu 0 randuri inserate, cum se intampla in versiunea
-- initiala a acestui fisier fara aceasta garda.
--
-- Deliberat EXCLUSE din acest import (5 din cele 26 de instantanee
-- calculate in registru), ca site-ul sa nu afiseze niciodata un NAV stiut
-- incomplet sau nesigur:
-- - EU 2026-05-22: pretul ALV neconfirmat la acea data (Preturi_Istorice: LIPSA)
-- - EU 2026-06-19: pretul ASML neconfirmat la acea data (Preturi_Istorice: LIPSA)
-- - EU 2026-06-26: pretul ASML neconfirmat la acea data (Preturi_Istorice: LIPSA)
-- - EU 2026-07-24: pretul PRY are sursa, dar discrepanta de atribuire a
-- datei (vezi nota de mai sus) - nu suficient de sigur pentru import
-- - EU 2026-07-31: pretul PRY neconfirmat la acea data (Preturi_Istorice: LIPSA)
-- Se adauga separat, printr-un seed mic ulterior, imediat ce preturile
-- lipsa/discrepantele sunt confirmate (vezi Surse_Audit din registru
-- pentru toate detaliile).
--
-- capital_contributed = 10000 pe toate randurile (o singura contributie
-- initiala per portofoliu, fara depuneri/retrageri ulterioare pana la
-- 31.07.2026 - vezi portfolio_transactions din seed-ul v5). cumulative_return_pct
-- e CALCULAT la insert din (nav_value - capital_contributed) /
-- capital_contributed - randament money-weighted, exact cum e definit in
-- comentariul coloanei din migrarea 202607290001_member_portfolios.sql -
-- nu e retastat din Excel, ca sa nu poata diverge de nav_value. IMPORTANT:
-- Excel-ul stocheaza acest camp ca fractie (conventia Excel pentru
-- procente, ex. 0.036 afisat "0.04%" prin formatare de celula), dar
-- api/account-portfolios.js + member-portfolios.js citesc coloana din
-- baza de date direct ca numar procentual (pct.toFixed(2)+"%", fara nicio
-- inmultire) - de aceea formula de mai jos inmulteste cu 100. O copiere
-- directa a valorii din Excel ar fi produs randamente afisate de 100 de
-- ori mai mici pe site.
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
-- Garda finala (adaugata 2026-08-05): dupa insert, scriptul numara exact
-- cate din cele 21 de randuri (portofoliu, data) aprobate in acest import
-- exista in tabela si opreste tranzactia cu eroare (inainte de commit)
-- daca numarul nu e exact 21 - nu doar "fara eroare SQL", ci verificat
-- explicit ca rezultatul e cel asteptat.
--
-- Nu atinge nicio alta tabela. Nu se aplica automat - fisier versionat, de
-- rulat manual (Supabase SQL Editor) DUPA aprobare separata a
-- proprietarului, la fel ca toate migrarile/seed-urile anterioare din
-- acest proiect.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase, PostgreSQL 16):
-- (a) rulat pe un schema fara randuri in portfolios -> garda de la inceput
-- opreste scriptul cu RAISE EXCEPTION, 0 randuri inserate, transactia nu
-- se aplica; (b) rulat dupa inserarea randurilor portfolios(US/EU) ->
-- exact 21 randuri inserate (14 US + 7 EU), garda finala trece fara
-- eroare; (c) rulat a doua oara (idempotenta) -> tot 21 randuri, fara
-- duplicate, fara eroare (on conflict do update); (d) simulat un rand
-- lipsa/in plus fata de cele 21 asteptate -> garda finala opreste
-- tranzactia cu eroare, asa cum e proiectata.

begin;

-- ---------------------------------------------------------------------------
-- Garda 1 (inainte de insert): portofoliile US si EU trebuie sa existe deja
-- (din supabase/seeds/202607290001_portfolios_metadata_seed.sql, v5).
-- ---------------------------------------------------------------------------
do $$
declare
us_id uuid;
eu_id uuid;
begin
select id into us_id from public.portfolios where code = 'US';
select id into eu_id from public.portfolios where code = 'EU';

if us_id is null then
raise exception 'Seed oprit: portofoliul cu code=US nu exista in public.portfolios. Ruleaza mai intai supabase/seeds/202607290001_portfolios_metadata_seed.sql (v5) inainte de acest fisier.';
end if;

if eu_id is null then
raise exception 'Seed oprit: portofoliul cu code=EU nu exista in public.portfolios. Ruleaza mai intai supabase/seeds/202607290001_portfolios_metadata_seed.sql (v5) inainte de acest fisier.';
end if;
end $$;

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
-- --- EU (EUR, fondat 2026-05-18) - 7/12 instantanee (5 excluse, vezi antet) ---
('EU', '2026-05-18'::date, 9999.52::numeric, 10000::numeric, 'EUR'::text),
('EU', '2026-05-29'::date, 10308.24::numeric, 10000::numeric, 'EUR'),
('EU', '2026-06-05'::date, 10344.81::numeric, 10000::numeric, 'EUR'),
('EU', '2026-06-12'::date, 10403.58::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-03'::date, 10604.89::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-10'::date, 10364.71::numeric, 10000::numeric, 'EUR'),
('EU', '2026-07-17'::date, 10311.44::numeric, 10000::numeric, 'EUR')
) as v(portfolio_code, as_of_date, nav_value, capital_contributed, currency)
on true
where p.code = v.portfolio_code
on conflict (portfolio_id, as_of_date) do update set
nav_value = excluded.nav_value,
capital_contributed = excluded.capital_contributed,
cumulative_return_pct = excluded.cumulative_return_pct,
currency = excluded.currency;

-- ---------------------------------------------------------------------------
-- Garda 2 (dupa insert, inainte de commit): trebuie sa existe exact 21 de
-- randuri pentru cele (portofoliu, data) aprobate in acest import - nici
-- mai putine (insert partial/esuat), nici mai multe (cheie gresita).
-- ---------------------------------------------------------------------------
do $$
declare
us_id uuid;
eu_id uuid;
expected_dates jsonb := '{
"US": ["2026-05-07","2026-05-08","2026-05-15","2026-05-22","2026-05-29","2026-06-05","2026-06-12","2026-06-19","2026-06-26","2026-07-03","2026-07-10","2026-07-17","2026-07-24","2026-07-31"],
"EU": ["2026-05-18","2026-05-29","2026-06-05","2026-06-12","2026-07-03","2026-07-10","2026-07-17"]
}'::jsonb;
total_count int;
expected_total int := 21;
begin
select id into us_id from public.portfolios where code = 'US';
select id into eu_id from public.portfolios where code = 'EU';

select count(*) into total_count
from public.portfolio_performance_history h
where (h.portfolio_id = us_id and h.as_of_date::text in (select jsonb_array_elements_text(expected_dates->'US')))
or (h.portfolio_id = eu_id and h.as_of_date::text in (select jsonb_array_elements_text(expected_dates->'EU')));

if total_count <> expected_total then
raise exception 'Seed oprit inainte de commit: dupa rulare exista % randuri pentru cele % de perechi (portofoliu, data) aprobate in acest import, in loc de %. Verifica manual inainte de a continua (posibil rand lipsa, cheie gresita sau conflict neasteptat).', total_count, expected_total, expected_total;
end if;
end $$;

commit;
