-- 202608140005_pgcron_pgnet_portfolio_sync_dormant_rollback.sql
--
-- Rollback pentru supabase/migrations/202608140005_pgcron_pgnet_portfolio_sync_dormant.sql.
-- NU se executa automat. Rulare manuala DOAR daca se decide anularea.
--
-- Aplicati acest fisier PRIMUL dintre cele 5 rollback-uri Etapa 4 (ordine
-- inversa fata de migrare: 005 -> 004 -> 003 -> 002 -> 001), ca sa nu mai
-- existe niciun job programat inainte de a sterge functiile pe care le-ar
-- putea apela.
--
-- Sigur de rulat INDIFERENT daca programarea a fost vreodata activata sau
-- nu (`cron.unschedule` e no-op daca job-ul nu exista). NU dezinstaleaza
-- extensiile pg_cron/pg_net - alte job-uri din acelasi proiect Supabase ar
-- putea depinde de ele; dezinstalarea extensiilor nu face parte din acest
-- rollback si necesita verificare separata daca e vreodata dorita.

select cron.unschedule('portfolio-price-sync');
select cron.unschedule('portfolio-price-sync-weekly-final');

-- Optional, doar daca a fost creat secretul in Vault la activare:
-- select vault.delete_secret('portfolio_cron_secret');
