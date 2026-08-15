-- 202608140001_provider_symbol_seed_rollback.sql
--
-- Rollback pentru supabase/seeds/202608140001_provider_symbol_seed.sql.
-- NU se executa automat.
--
-- De folosit DOAR daca se doreste anularea maparii EODHD FARA a sterge si
-- coloanele (adica NU se ruleaza rollback-ul de schema
-- 202608140001_add_provider_symbol_mapping_rollback.sql) - de exemplu, ca
-- sa se opreasca temporar sincronizarea (orice pozitie activa fara
-- provider_symbol forteaza runul sa fie "partial", vezi
-- api/cron/sync-portfolio-prices.js) fara sa se renunte la coloane.
--
-- Daca se ruleaza si rollback-ul de schema (202608140001_add_provider_symbol_mapping_rollback.sql),
-- ACEST script devine inutil (coloanele oricum dispar) - nu e nevoie sa fie
-- rulat inainte de acela.

update public.portfolio_positions
set provider_symbol = null,
    provider_price_multiplier = 1
where provider_symbol is not null
   or provider_price_multiplier <> 1;
