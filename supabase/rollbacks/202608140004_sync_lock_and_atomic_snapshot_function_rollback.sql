-- 202608140004_sync_lock_and_atomic_snapshot_function_rollback.sql
--
-- Rollback pentru supabase/migrations/202608140004_sync_lock_and_atomic_snapshot_function.sql.
-- NU se executa automat. Al doilea din cele 5 rollback-uri (dupa 005).
--
-- Sigur de rulat: dupa acest script, api/cron/sync-portfolio-prices.js va
-- primi eroare la orice apel RPC (functia nu mai exista) - normal, codul
-- trebuie sa fie deja revertit/nedeployat in acelasi timp (vezi nota de la
-- finalul rollback-ului 202608140001).

drop function if exists public.apply_portfolio_price_snapshot(jsonb);
