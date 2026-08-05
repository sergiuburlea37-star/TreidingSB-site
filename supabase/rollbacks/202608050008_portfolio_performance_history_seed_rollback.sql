-- 202608050008_portfolio_performance_history_seed_rollback.sql
--
-- Rollback pentru 202608050008_portfolio_performance_history_seed.sql.
-- Elimina DOAR cele 22 de randuri introduse de acel seed, identificate
-- strict prin (portfolio_id via code, as_of_date) SI nav_value exact - NU
-- "toate randurile din portfolio_performance_history" si NU doar cheia
-- (portfolio_id, as_of_date) fara verificarea valorii.
--
-- Siguranta: daca oricare din cele 22 de randuri lipseste sau are alt
-- nav_value decat cel introdus de acest seed (ex. a fost corectat manual
-- de admin intre timp, sau suprascris de o rulare ulterioara a seed-ului
-- cu valori actualizate prin on conflict do update), scriptul se opreste
-- cu exceptie in loc sa stearga o valoare care nu mai e cea introdusa de
-- acest fisier. Acelasi tipar ca 202607300006_fx_rates_eu_may2026_seed_rollback.sql.
-- Nu atinge nicio alta tabela.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase, PostgreSQL 16):
-- rollback curat dupa seed (sterge exact 22 randuri, tabela ramane goala)
-- si test de siguranta separat (un nav_value modificat manual pe unul din
-- cele 22 randuri -> guard-ul opreste rollback-ul cu exceptie, 0 randuri
-- sterse).

begin;

do $$
declare
expected jsonb := '[
{"code":"US","as_of_date":"2026-05-07","nav_value":10003.60},
{"code":"US","as_of_date":"2026-05-08","nav_value":9998.37},
{"code":"US","as_of_date":"2026-05-15","nav_value":10007.01},
{"code":"US","as_of_date":"2026-05-22","nav_value":10156.25},
{"code":"US","as_of_date":"2026-05-29","nav_value":10289.64},
{"code":"US","as_of_date":"2026-06-05","nav_value":10125.45},
{"code":"US","as_of_date":"2026-06-12","nav_value":10191.23},
{"code":"US","as_of_date":"2026-06-19","nav_value":10361.95},
{"code":"US","as_of_date":"2026-06-26","nav_value":10270.84},
{"code":"US","as_of_date":"2026-07-03","nav_value":10420.26},
{"code":"US","as_of_date":"2026-07-10","nav_value":10342.36},
{"code":"US","as_of_date":"2026-07-17","nav_value":10262.30},
{"code":"US","as_of_date":"2026-07-24","nav_value":10355.35},
{"code":"US","as_of_date":"2026-07-31","nav_value":10297.90},
{"code":"EU","as_of_date":"2026-05-18","nav_value":9999.52},
{"code":"EU","as_of_date":"2026-05-29","nav_value":10308.24},
{"code":"EU","as_of_date":"2026-06-05","nav_value":10344.81},
{"code":"EU","as_of_date":"2026-06-12","nav_value":10403.58},
{"code":"EU","as_of_date":"2026-07-03","nav_value":10604.89},
{"code":"EU","as_of_date":"2026-07-10","nav_value":10364.71},
{"code":"EU","as_of_date":"2026-07-17","nav_value":10311.44},
{"code":"EU","as_of_date":"2026-07-24","nav_value":10384.94}
]'::jsonb;
row_data jsonb;
found_nav numeric;
target_portfolio_id uuid;
begin
for row_data in select * from jsonb_array_elements(expected)
loop
select id into target_portfolio_id from public.portfolios where code = (row_data->>'code');

if target_portfolio_id is null then
raise exception 'Rollback oprit: lipseste portofoliul cu code=% (era asteptat) - verifica manual inainte de a continua.', (row_data->>'code');
end if;

select nav_value into found_nav
from public.portfolio_performance_history
where portfolio_id = target_portfolio_id
and as_of_date = (row_data->>'as_of_date')::date;

if found_nav is null then
raise exception 'Rollback oprit: lipseste randul %/% (era asteptat, introdus de seed-ul 202608050008) - verifica manual inainte de a continua.', (row_data->>'code'), (row_data->>'as_of_date');
end if;

if found_nav <> (row_data->>'nav_value')::numeric then
raise exception 'Rollback oprit: randul %/% are nav_value=% in baza de date, diferit de % introdus de seed-ul 202608050008 (a fost corectat/suprascris intre timp) - verifica manual inainte de a continua.',
(row_data->>'code'), (row_data->>'as_of_date'), found_nav, (row_data->>'nav_value');
end if;
end loop;
end $$;

delete from public.portfolio_performance_history h
using public.portfolios p
where h.portfolio_id = p.id
and (
(p.code = 'US' and h.as_of_date in ('2026-05-07','2026-05-08','2026-05-15','2026-05-22','2026-05-29','2026-06-05','2026-06-12','2026-06-19','2026-06-26','2026-07-03','2026-07-10','2026-07-17','2026-07-24','2026-07-31'))
or (p.code = 'EU' and h.as_of_date in ('2026-05-18','2026-05-29','2026-06-05','2026-06-12','2026-07-03','2026-07-10','2026-07-17','2026-07-24'))
)
and (
(p.code = 'US' and h.as_of_date = '2026-05-07' and h.nav_value = 10003.60)
or (p.code = 'US' and h.as_of_date = '2026-05-08' and h.nav_value = 9998.37)
or (p.code = 'US' and h.as_of_date = '2026-05-15' and h.nav_value = 10007.01)
or (p.code = 'US' and h.as_of_date = '2026-05-22' and h.nav_value = 10156.25)
or (p.code = 'US' and h.as_of_date = '2026-05-29' and h.nav_value = 10289.64)
or (p.code = 'US' and h.as_of_date = '2026-06-05' and h.nav_value = 10125.45)
or (p.code = 'US' and h.as_of_date = '2026-06-12' and h.nav_value = 10191.23)
or (p.code = 'US' and h.as_of_date = '2026-06-19' and h.nav_value = 10361.95)
or (p.code = 'US' and h.as_of_date = '2026-06-26' and h.nav_value = 10270.84)
or (p.code = 'US' and h.as_of_date = '2026-07-03' and h.nav_value = 10420.26)
or (p.code = 'US' and h.as_of_date = '2026-07-10' and h.nav_value = 10342.36)
or (p.code = 'US' and h.as_of_date = '2026-07-17' and h.nav_value = 10262.30)
or (p.code = 'US' and h.as_of_date = '2026-07-24' and h.nav_value = 10355.35)
or (p.code = 'US' and h.as_of_date = '2026-07-31' and h.nav_value = 10297.90)
or (p.code = 'EU' and h.as_of_date = '2026-05-18' and h.nav_value = 9999.52)
or (p.code = 'EU' and h.as_of_date = '2026-05-29' and h.nav_value = 10308.24)
or (p.code = 'EU' and h.as_of_date = '2026-06-05' and h.nav_value = 10344.81)
or (p.code = 'EU' and h.as_of_date = '2026-06-12' and h.nav_value = 10403.58)
or (p.code = 'EU' and h.as_of_date = '2026-07-03' and h.nav_value = 10604.89)
or (p.code = 'EU' and h.as_of_date = '2026-07-10' and h.nav_value = 10364.71)
or (p.code = 'EU' and h.as_of_date = '2026-07-17' and h.nav_value = 10311.44)
or (p.code = 'EU' and h.as_of_date = '2026-07-24' and h.nav_value = 10384.94)
);

commit;
