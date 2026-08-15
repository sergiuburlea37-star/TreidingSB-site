-- 202608140001_add_provider_symbol_mapping.sql
--
-- Etapa 4 (integrare EODHD Live Delayed): adauga pe portfolio_positions
-- coloanele necesare pt. sincronizarea automata a preturilor cu un furnizor
-- extern. Strict aditiva - nu modifica nicio coloana/tabela existenta.
--
-- provider_symbol: codul folosit de EODHD (format TICKER.EXCHANGE, ex.
-- 'IWDA.LSE', 'AAPL.US') pentru pozitia respectiva. NULL = pozitia nu e
-- inca mapata - api/cron/sync-portfolio-prices.js trateaza orice pozitie
-- ACTIVA fara provider_symbol ca motiv de run "partial" (nu publica niciun
-- rezultat pana nu e mapata explicit).
--
-- provider_price_multiplier: multiplicator aplicat pretului brut intors de
-- EODHD, inainte de a fi scris in current_price. Necesar pt. instrumente
-- cotate in subunitate monetara (ex. actiuni LSE cotate in GBX/pence, nu in
-- GBP - vezi comentariul existent din supabase/seeds/202607290001_portfolios_metadata_seed.sql
-- linia RR., "1259.00 GBX = 12.59 GBP"). Implicit 1 (fara conversie).
--
-- NU se executa automat. Fisier versionat, de revizuit si rulat manual
-- (Supabase SQL Editor sau `supabase db push`) DOAR dupa aprobare explicita.
-- Valorile efective (care ticker -> ce provider_symbol/multiplier) se
-- introduc separat, in supabase/seeds/202608140001_provider_symbol_seed.sql -
-- schema si datele raman in fisiere distincte, ca in restul proiectului
-- (vezi 202607290001_member_portfolios.sql vs. .../seeds/202607290001_portfolios_metadata_seed.sql).

begin;

alter table public.portfolio_positions
  add column provider_symbol text,
  add column provider_price_multiplier numeric not null default 1
    check (provider_price_multiplier > 0);

alter table public.portfolio_positions
  add constraint portfolio_positions_active_provider_mapping_check
  check (
    (provider_symbol is null or provider_symbol = btrim(provider_symbol))
    and (
      not active or (
        provider_symbol is not null
        and btrim(provider_symbol) <> ''
        and btrim(provider_symbol) ~ '^.+\.[A-Za-z0-9]+$'
        and upper(regexp_replace(btrim(provider_symbol), '^.*\.', '')) = any (
          array['US','LSE','XETRA','AS','PA','SW','MC','MI','BR','ST','CO','FOREX']::text[]
        )
        and provider_price_multiplier::text not in ('NaN', 'Infinity', '-Infinity')
        and provider_price_multiplier > 0
      )
    )
  ) not valid;

-- Seed-ul de mapping trebuie rulat inainte de VALIDATE CONSTRAINT. Comanda
-- ramane intentionat dormanta, ca si cronul:
-- alter table public.portfolio_positions validate constraint portfolio_positions_active_provider_mapping_check;

comment on column public.portfolio_positions.provider_symbol is
  'Cod EODHD (TICKER.EXCHANGE) folosit de api/cron/sync-portfolio-prices.js. NULL = pozitia nu e inca mapata; orice pozitie ACTIVA fara provider_symbol forteaza runul curent sa fie marcat "partial" (fara publicare de snapshot).';

comment on column public.portfolio_positions.provider_price_multiplier is
  'Multiplicator aplicat pretului brut EODHD inainte de a fi scris in current_price - necesar pt. instrumente cotate in subunitate (ex. GBX/pence pe LSE: 0.01 -> lire). Implicit 1 (fara conversie).';

commit;
