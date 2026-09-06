-- 202608140002_add_fx_rate_timestamp_and_pending_return_rollback.sql
--
-- Rollback pentru supabase/migrations/202608140002_add_fx_rate_timestamp_and_pending_return.sql.
-- NU se executa automat. Al patrulea din cele 5 rollback-uri.
--
-- ATENTIE: daca sincronizarea a rulat vreodata (source='delayed_feed' pe
-- randuri reale in fx_rates), restaurarea constrangerii originale
-- ('manual'/'live_feed' - fara 'delayed_feed') va ESUA cu o eroare de
-- validare CHECK pana cand acele randuri sunt sterse sau actualizate manual
-- inainte de rulare. Verificati explicit inainte:
--   select count(*) from public.fx_rates where source = 'delayed_feed';
-- Daca returneaza > 0, decideti (stergere sau UPDATE la 'manual') inainte
-- de a rula acest script.

alter table public.fx_rates
  drop constraint if exists fx_rates_positive_finite_check;

alter table public.fx_rates
  drop constraint if exists fx_rates_source_check,
  add constraint fx_rates_source_check check (source in ('manual', 'live_feed'));

alter table public.portfolio_positions
  drop constraint if exists portfolio_positions_positive_finite_current_price_check,
  drop constraint if exists portfolio_positions_quantity_domain_check,
  drop constraint if exists portfolio_positions_avg_price_domain_check;

alter table public.portfolio_transactions
  drop constraint if exists portfolio_transactions_amount_domain_check,
  drop constraint if exists portfolio_transactions_fee_domain_check,
  drop constraint if exists portfolio_transactions_quantity_domain_check,
  drop constraint if exists portfolio_transactions_price_domain_check,
  drop constraint if exists portfolio_transactions_trade_fields_check;

alter table public.portfolio_dividends
  drop constraint if exists portfolio_dividends_amount_domain_check;

alter table public.portfolio_performance_history
  drop constraint if exists portfolio_performance_nav_domain_check,
  drop constraint if exists portfolio_performance_capital_domain_check,
  drop constraint if exists portfolio_performance_return_domain_check;

alter table public.fx_rates
  drop column if exists provider_fetched_at;

alter table public.portfolio_performance_history
  drop column if exists return_is_pending;

-- Dupa acest script, api/account-portfolios.js va primi eroare la SELECT-ul
-- care cere coloana return_is_pending din portfolio_performance_history -
-- codul trebuie revertit/nedeployat in acelasi timp (vezi nota din
-- rollback-ul 202608140001 de mai jos, in ordine).
