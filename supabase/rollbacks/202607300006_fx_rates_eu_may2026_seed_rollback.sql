-- 202607300006_fx_rates_eu_may2026_seed_rollback.sql
--
-- Rollback pentru 202607300006_fx_rates_eu_may2026_seed.sql. Elimina DOAR
-- cele 4 randuri introduse de acel seed, identificate strict prin
-- (base_currency='EUR', quote_currency, as_of_date='2026-05-18') SI rate-ul
-- exact BCE (0.9144 / 10.9465 / 1.1648 / 0.8702) - NU "toate randurile EUR/*
-- din 2026-05-18" si NU "toate randurile fx_rates".
--
-- Siguranta: daca oricare dintre cele 4 randuri lipseste sau are alt rate
-- decat cel introdus de seed (ex. a fost corectat manual de admin intre
-- timp, sau suprascris de un alt seed prin on conflict do update), scriptul
-- se opreste cu exceptie in loc sa stearga o valoare care nu mai e cea
-- introdusa de acest fisier. Nu atinge nicio alta tabela.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase): rollback
-- curat (sterge exact cele 4 randuri, restul fx_rates neatins) si test de
-- siguranta separat (un rate modificat manual pe unul din cele 4 randuri ->
-- guard-ul opreste rollback-ul cu exceptie, fara sa stearga nimic).

begin;

do $$
declare
  expected jsonb := '[
    {"quote_currency":"CHF","rate":0.9144},
    {"quote_currency":"SEK","rate":10.9465},
    {"quote_currency":"USD","rate":1.1648},
    {"quote_currency":"GBP","rate":0.8702}
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
      and as_of_date = '2026-05-18';

    if found_rate is null then
      raise exception 'Rollback oprit: lipseste randul EUR/% din 2026-05-18 (era asteptat, introdus de seed-ul 202607300006) - verifica manual inainte de a continua.', (row_data->>'quote_currency');
    end if;

    if found_rate <> (row_data->>'rate')::numeric then
      raise exception 'Rollback oprit: randul EUR/% din 2026-05-18 are rate=% in baza de date, diferit de %  introdus de seed-ul 202607300006 (a fost corectat/suprascris intre timp) - verifica manual inainte de a continua.',
        (row_data->>'quote_currency'), found_rate, (row_data->>'rate');
    end if;
  end loop;
end $$;

delete from public.fx_rates
where base_currency = 'EUR'
  and quote_currency in ('CHF', 'SEK', 'USD', 'GBP')
  and as_of_date = '2026-05-18'
  and (
    (quote_currency = 'CHF' and rate = 0.9144)
    or (quote_currency = 'SEK' and rate = 10.9465)
    or (quote_currency = 'USD' and rate = 1.1648)
    or (quote_currency = 'GBP' and rate = 0.8702)
  );

commit;
