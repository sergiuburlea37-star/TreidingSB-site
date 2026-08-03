-- 202607300008_fx_rates_us_may2026_seed_rollback.sql
--
-- NEEXECUTAT. Rollback pentru 202607300007_fx_rates_us_may2026_seed.sql.
-- De rulat manual DOAR daca seed-ul de mai sus a fost deja aplicat si
-- proprietarul decide sa revina la starea anterioara (fara cursuri BCE
-- pentru 2026-05-07 in fx_rates).
--
-- Sterge exact cele 2 randuri introduse de seed, identificate prin cheia
-- naturala (base_currency, quote_currency, as_of_date) - nu prin id, ca sa
-- fie sigur indiferent de ordinea de inserare. Nu atinge nicio alta data
-- din fx_rates (in particular, NU sterge randurile din 2026-05-18 introduse
-- de 202607300006_fx_rates_eu_may2026_seed.sql).

begin;

delete from public.fx_rates
where base_currency = 'EUR'
  and quote_currency in ('USD', 'GBP')
  and as_of_date = '2026-05-07';

commit;
