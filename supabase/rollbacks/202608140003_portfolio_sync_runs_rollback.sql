-- 202608140003_portfolio_sync_runs_rollback.sql
--
-- Rollback pentru supabase/migrations/202608140003_portfolio_sync_runs.sql.
-- NU se executa automat. Al treilea din cele 5 rollback-uri (dupa 005, 004 -
-- functia apply_portfolio_price_snapshot() din 004 foloseste tabelele si
-- functiile de aici, deci trebuie stearsa INAINTE de acest script).
--
-- ATENTIE: sterge definitiv istoricul de audit al sincronizarilor
-- (portfolio_sync_runs) - faceti un export/backup inainte daca migrarea a
-- fost deja folosita in productie. Nu atinge nicio tabela din familia
-- originala a portofoliilor (portfolios, portfolio_positions, etc.).

drop policy if exists sync_runs_active_read on public.portfolio_sync_runs;

drop function if exists public.acquire_portfolio_sync_lease(uuid, int);
drop function if exists public.release_portfolio_sync_lease(uuid);

drop table if exists public.portfolio_sync_lease;
drop table if exists public.portfolio_sync_runs;

-- Dupa acest script, api/account-portfolios.js.lastSyncStatus va reveni
-- automat la `null` (SELECT pe un tabel inexistent e tratat ca eroare
-- necritica, vezi comentariul "syncRunRes.error tratat ca necunoscut" din
-- acel fisier) - membrii nu mai vad banner-ul de sincronizare partiala,
-- fara alt efect.
