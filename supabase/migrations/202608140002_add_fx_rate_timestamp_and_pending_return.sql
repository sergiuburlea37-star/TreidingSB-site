-- 202608140002_add_fx_rate_timestamp_and_pending_return.sql
--
-- Etapa 4 (integrare EODHD Live Delayed): doua adaugari mici, aditive,
-- ambele necesare aceleiasi functionalitati (sincronizarea automata de
-- preturi/cursuri) - grupate intr-un singur fisier pentru ca sunt strans
-- legate, nu pentru ca ar fi acelasi tip de schimbare.
--
-- 1. fx_rates.provider_fetched_at: as_of_date (coloana existenta) ramane
--    data calendaristica folosita pt. lookup (convert()/convertAsOf(), vezi
--    api/_lib/fx-convert.js - NESCHIMBATA). provider_fetched_at e strict
--    timestamp-ul PROPRIU al furnizorului pentru cursul respectiv (nu
--    clock-ul serverului nostru) - necesar ca sa nu se poata niciodata
--    reeticheta un curs vechi drept "cursul de azi" doar pentru ca a fost
--    SCRIS azi in baza de date (cerinta explicita a proiectului). Folosit
--    de public.apply_portfolio_price_snapshot() (vezi migrarea urmatoare)
--    ca sa decida daca un upsert de curs chiar aduce o informatie mai noua
--    de la furnizor, nu doar o rescriere cu acelasi curs sau unul mai vechi.
--
-- 2. portfolio_performance_history.return_is_pending: randamentul cumulat
--    (cumulative_return_pct, numeric) nu poate stoca valoarea "pending".
--    Cand exista vreun DEPOSIT/WITHDRAWAL dupa founded_date, formula simpla
--    (nav/capital-1)*100 nu mai e un randament money-weighted corect -
--    proiectul cere explicit sa NU fie calculata si etichetata gresit ca
--    atare, ci raportata ca "pending" pana la implementarea TWR/XIRR.
--    return_is_pending=true -> cumulative_return_pct ramane NULL (nu o
--    valoare calculata gresit, doar marcata ca atare). api/account-portfolios.js
--    expune separat, din date live de ledger, acelasi steag pentru
--    totalReturnPct - aceasta coloana e sursa persistata pentru istoricul
--    din portfolio_performance_history.
--
-- Niciun timestamp nou nu e necesar pentru pretul unei pozitii - acela
-- foloseste coloana deja existenta portfolio_positions.price_updated_at,
-- exact scopul ei original (vezi 202607290001_member_portfolios.sql).
--
-- NU se executa automat. Rulare manuala dupa aprobare.

begin;

alter table public.fx_rates
  add column provider_fetched_at timestamptz;

alter table public.fx_rates
  drop constraint fx_rates_source_check,
  add constraint fx_rates_source_check check (source in ('manual', 'delayed_feed', 'live_feed')),
  add constraint fx_rates_positive_finite_check
    check (rate::text not in ('NaN', 'Infinity', '-Infinity') and rate > 0) not valid;

alter table public.portfolio_positions
  add constraint portfolio_positions_positive_finite_current_price_check
    check (
      current_price is null or (
        current_price::text not in ('NaN', 'Infinity', '-Infinity') and current_price > 0
      )
    ) not valid;

alter table public.portfolio_positions
  add constraint portfolio_positions_quantity_domain_check
    check (quantity::text not in ('NaN', 'Infinity', '-Infinity') and quantity >= 0) not valid,
  add constraint portfolio_positions_avg_price_domain_check
    check (
      avg_price::text not in ('NaN', 'Infinity', '-Infinity')
      and avg_price >= 0
      and (quantity = 0 or avg_price > 0)
    ) not valid;

alter table public.portfolio_transactions
  add constraint portfolio_transactions_amount_domain_check
    check (amount::text not in ('NaN', 'Infinity', '-Infinity') and amount > 0) not valid,
  add constraint portfolio_transactions_fee_domain_check
    check (fee_amount::text not in ('NaN', 'Infinity', '-Infinity') and fee_amount >= 0) not valid,
  add constraint portfolio_transactions_quantity_domain_check
    check (
      quantity is null or (
        quantity::text not in ('NaN', 'Infinity', '-Infinity') and quantity > 0
      )
    ) not valid,
  add constraint portfolio_transactions_price_domain_check
    check (
      price is null or (
        price::text not in ('NaN', 'Infinity', '-Infinity') and price > 0
      )
    ) not valid,
  add constraint portfolio_transactions_trade_fields_check
    check (type not in ('BUY', 'SELL') or (quantity is not null and price is not null)) not valid;

alter table public.portfolio_dividends
  add constraint portfolio_dividends_amount_domain_check
    check (amount::text not in ('NaN', 'Infinity', '-Infinity') and amount > 0) not valid;

alter table public.portfolio_performance_history
  add column return_is_pending boolean not null default false;

alter table public.portfolio_performance_history
  add constraint portfolio_performance_nav_domain_check
    check (nav_value::text not in ('NaN', 'Infinity', '-Infinity') and nav_value >= 0) not valid,
  add constraint portfolio_performance_capital_domain_check
    check (capital_contributed::text not in ('NaN', 'Infinity', '-Infinity') and capital_contributed > 0) not valid,
  add constraint portfolio_performance_return_domain_check
    check (
      (return_is_pending = true and cumulative_return_pct is null)
      or (
        return_is_pending = false
        and cumulative_return_pct is not null
        and cumulative_return_pct::text not in ('NaN', 'Infinity', '-Infinity')
      )
    ) not valid;

comment on column public.fx_rates.provider_fetched_at is
  'Timestamp-ul furnizorului (EODHD) pentru acest curs, cand source=delayed_feed - NU clock-ul serverului nostru. as_of_date ramane data folosita pentru lookup (convert/convertAsOf); provider_fetched_at e strict pentru a decide daca un upsert aduce o informatie mai noua si pentru audit.';

comment on column public.portfolio_performance_history.return_is_pending is
  'true daca a existat vreun DEPOSIT/WITHDRAWAL dupa founded_date pana la as_of_date - formula simpla (nav/capital-1)*100 nu mai e randament money-weighted corect. cumulative_return_pct ramane NULL cand acest flag e true - vezi api/account-portfolios.js pentru echivalentul calculat live din ledger.';

commit;
