-- 202607290001_member_portfolios_rollback.sql
--
-- Rollback pentru supabase/migrations/202607290001_member_portfolios.sql.
--
-- NU se executa automat si NU face parte din directorul supabase/migrations/
-- (asta ca sa nu fie preluat accidental de `supabase db push` ca o migrare
-- normala de aplicat inainte - e strict un script manual, de rulat DOAR daca
-- se decide anularea migrarii de mai sus, dupa aprobare separata).
--
-- Sigur de rulat oricand DUPA aplicarea migrarii 202607290001: nu atinge
-- nicio tabela/view/functie/policy existenta inainte de acea migrare
-- (public.profiles, public.subscriptions, public.trading_ideas, public.reports,
-- public.is_admin(), public.has_active_subscription() raman neatinse).
--
-- ATENTIE: aceasta operatie sterge definitiv toate datele introduse in cele
-- 6 tabele noi (portofolii, pozitii, tranzactii, dividende, istoric,
-- curs valutar) - faceti un export/backup inainte daca migrarea a fost deja
-- folosita in productie cu date reale.

-- View-ul public, inainte de tabele (depinde de public.portfolios)
drop view if exists public.portfolios_public;

-- Policies (drop explicit, desi `drop table cascade` le-ar sterge oricum -
-- le enumeram pentru claritate si pentru cazul unui rollback partial)
drop policy if exists fx_rates_admin_all on public.fx_rates;
drop policy if exists fx_rates_active_read on public.fx_rates;
drop policy if exists performance_admin_all on public.portfolio_performance_history;
drop policy if exists performance_active_read on public.portfolio_performance_history;
drop policy if exists dividends_admin_all on public.portfolio_dividends;
drop policy if exists dividends_active_read on public.portfolio_dividends;
drop policy if exists transactions_admin_all on public.portfolio_transactions;
drop policy if exists transactions_active_read on public.portfolio_transactions;
drop policy if exists positions_admin_all on public.portfolio_positions;
drop policy if exists positions_active_read on public.portfolio_positions;
drop policy if exists portfolios_admin_all on public.portfolios;
drop policy if exists portfolios_active_read on public.portfolios;

-- Tabele, in ordine inversa fata de migrarea forward (copii inainte de parinti)
drop table if exists public.fx_rates;
drop table if exists public.portfolio_performance_history;
drop table if exists public.portfolio_dividends;
drop table if exists public.portfolio_transactions;
drop table if exists public.portfolio_positions;
drop table if exists public.portfolios;

-- Dupa acest script, schema Supabase revine exact la starea dinainte de
-- 202607290001_member_portfolios.sql. Codul din api/account-portfolios.js si
-- api/admin/[name].js (rutele portfolios/*) va incepe sa raspunda cu erori
-- de tip "relation does not exist" daca ramane deployat fara migrare - de
-- aceea rollback-ul de schema si rollback-ul de cod (revert commit-uri PR)
-- trebuie facute impreuna.
