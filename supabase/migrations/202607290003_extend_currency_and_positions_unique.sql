-- 202607290003_extend_currency_and_positions_unique.sql
--
-- Migrare de schema (aditiva, sigura) ceruta pentru a putea importa pozitiile
-- reale EU care folosesc DKK (NOVO B) si SEK (INVE B) - monede care nu erau
-- acceptate de constrangerile CHECK existente.
--
-- Ce face:
-- 1. Extinde 5 constrangeri CHECK pe moneda, ca sa accepte si 'DKK'/'SEK',
--    pastrand toate valorile deja acceptate (GBP/EUR/USD/CHF neschimbate).
--    NU se ating portfolios_base_currency_check si
--    portfolio_performance_history_currency_check - niciun portofoliu nu
--    foloseste DKK/SEK ca moneda de baza, deci nu au nevoie de extindere.
-- 2. Adauga o constrangere UNIQUE (portfolio_id, ticker) pe
--    portfolio_positions - lipsea din schema initiala, si e necesara ca sa
--    putem face import idempotent (`on conflict` are nevoie de o cheie
--    unica; in acest moment doar `id`-ul generat automat e unic, ceea ce ar
--    permite duplicate la o rulare repetata a seed-ului de pozitii).
--
-- Nu sterge si nu redenumeste nimic. Nu atinge date existente (toate
-- tabelele sunt goale la momentul redactarii acestei migrari).
--
-- Testata local intr-un sandbox Postgres aruncat (nu Supabase), pe o copie
-- a schemei reale din Production - se aplica curat, toate cele 7
-- constrangeri rezultate confirmate corect. NU se aplica automat aici -
-- ramane pe branch-ul Draft PR #9, necesita rulare manuala in Supabase
-- dupa aprobare separata (la fel ca migrarea initiala a schemei).

begin;

alter table public.portfolio_positions
  drop constraint portfolio_positions_instrument_currency_check,
  add constraint portfolio_positions_instrument_currency_check
    check (instrument_currency in ('GBP','EUR','USD','CHF','DKK','SEK'));

alter table public.portfolio_transactions
  drop constraint portfolio_transactions_currency_check,
  add constraint portfolio_transactions_currency_check
    check (currency in ('GBP','EUR','USD','CHF','DKK','SEK'));

alter table public.portfolio_dividends
  drop constraint portfolio_dividends_currency_check,
  add constraint portfolio_dividends_currency_check
    check (currency in ('GBP','EUR','USD','CHF','DKK','SEK'));

alter table public.fx_rates
  drop constraint fx_rates_base_currency_check,
  add constraint fx_rates_base_currency_check
    check (base_currency in ('GBP','EUR','USD','CHF','DKK','SEK'));

alter table public.fx_rates
  drop constraint fx_rates_quote_currency_check,
  add constraint fx_rates_quote_currency_check
    check (quote_currency in ('GBP','EUR','USD','CHF','DKK','SEK'));

alter table public.portfolio_positions
  add constraint portfolio_positions_portfolio_id_ticker_key
    unique (portfolio_id, ticker);

commit;
