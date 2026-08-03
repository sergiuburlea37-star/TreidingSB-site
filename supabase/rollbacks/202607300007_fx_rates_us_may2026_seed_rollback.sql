-- 202607300007_fx_rates_us_may2026_seed_rollback.sql
--
-- Rollback pentru 202607300007_fx_rates_us_may2026_seed.sql. Elimina DOAR
-- cele 2 randuri introduse de acel seed, identificate strict prin
-- (base_currency='EUR', quote_currency, as_of_date='2026-05-07') SI rate-ul
-- exact BCE (1.1770 / 0.8641) - NU "toate randurile EUR/* din 2026-05-07"
-- si NU "toate randurile fx_rates".
--
-- Siguranta: daca oricare dintre cele 2 randuri lipseste sau are alt rate
-- decat cel introdus de seed (ex. a fost corectat manual de admin intre
-- timp, sau suprascris de un alt seed prin on conflict do update), scriptul
-- se opreste cu exceptie in loc sa stearga o valoare care nu mai e cea
-- introdusa de acest fisier. Nu atinge nicio alta tabela.
--
-- Mutat din supabase/seeds/ in supabase/rollbacks/ (2026-08-03), pentru a
-- respecta conventia deja existenta in acest repo (vezi
-- supabase/rollbacks/202607300006_fx_rates_eu_may2026_seed_rollback.sql) -
-- acelasi numar de secventa ca seed-ul corespunzator, guard de siguranta
-- identic ca structura. NEEXECUTAT.
begin;
do $$
declare
expected jsonb := '[
{"quote_currency":"USD","rate":1.1770},
{"quote_currency":"GBP","rate":0.8641}
]'::jsonb;
row_data jsonb;
found_rate numeric;
begin
for row_data in select * from jsonb_array_elements(expected)
loop
select rate into found_rate
from public.fx_rates
where base_currency = 'EUR'
and quote_currency = (row_data->>'quote_currency')
and as_of_date = '2026-05-07';
if found_rate is null then
raise exception 'Rollback oprit: lipseste randul EUR/% din 2026-05-07 (era asteptat, introdus de seed-ul 202607300007) - verifica manual inainte de a continua.', (row_data->>'quote_currency');
end if;
if found_rate <> (row_data->>'rate')::numeric then
raise exception 'Rollback oprit: randul EUR/% din 2026-05-07 are rate=% in baza de date, diferit de % introdus de seed-ul 202607300007 (a fost corectat/suprascris intre timp) - verifica manual inainte de a continua.', (row_data->>'quote_currency'), found_rate, (row_data->>'rate');
end if;
end loop;
end $$;
delete from public.fx_rates
where base_currency = 'EUR'
and quote_currency in ('USD', 'GBP')
and as_of_date = '2026-05-07'
and (
(quote_currency = 'USD' and rate = 1.1770)
or (quote_currency = 'GBP' and rate = 0.8641)
);
commit;
