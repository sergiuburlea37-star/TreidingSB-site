-- 202608140001_add_provider_symbol_mapping_rollback.sql
--
-- Rollback pentru supabase/migrations/202608140001_add_provider_symbol_mapping.sql.
-- NU se executa automat. Al cincilea (ultimul) din cele 5 rollback-uri
-- Etapa 4 - rulati-l DUPA celelalte 4 (005, 004, 003, 002), niciodata
-- inaintea lor (constrangerea si coloanele de aici sunt cele mai vechi din
-- lant si nimic din migrarile 002-005 nu depinde invers de ele, dar ordinea
-- inversa fata de aplicare ramane conventia sigura folosita in tot proiectul).
--
-- Sigur de rulat: coloanele provider_symbol/provider_price_multiplier nu
-- sunt referentiate de nicio alta tabela (nu sunt cheie straina) - stergerea
-- lor nu afecteaza portfolio_positions.id/ticker/quantity/etc.

alter table public.portfolio_positions
  drop constraint if exists portfolio_positions_active_provider_mapping_check;

alter table public.portfolio_positions
  drop column if exists provider_symbol,
  drop column if exists provider_price_multiplier;

-- ---------------------------------------------------------------------------
-- IMPORTANT - rollback-ul de schema (mai sus) trebuie facut IMPREUNA cu
-- rollback-ul de COD (nu doar de baza de date):
--
--   1. Nu mergeti pe main/productie cu acest branch (feature/eodhd-live-delayed-prices)
--      - pur si simplu nu il faceti merge; site-ul ramane neschimbat.
--   2. Daca branch-ul a fost DEJA deployat pe un mediu (preview/productie) si
--      NU sunteti multumiti: revert la commit-ul/deploy-ul anterior in Vercel
--      (Vercel pastreaza fiecare deploy anterior - "Instant Rollback" din
--      dashboard, fara sa fie nevoie de niciun git revert) SI rulati cele 5
--      fisiere de rollback de mai sus, in ordine (005 -> 004 -> 003 -> 002 -> 001),
--      in Supabase SQL Editor.
--   3. Daca cronul (migrarea 005) a fost activat si a apucat sa scrie preturi
--      reale: acele preturi/randuri raman in portfolio_positions.current_price /
--      fx_rates / portfolio_performance_history dupa rollback-ul de schema de
--      mai sus (schema revine la normal, dar VALORILE scrise de sincronizari
--      anterioare nu se sterg automat - ele arata pur si simplu ca date
--      introduse manual din acel moment inainte, la fel ca inainte de Etapa 4).
--      Daca se doreste si revenirea la preturile/valorile de dinainte de
--      Etapa 4, e nevoie de un backup/export facut INAINTE de prima activare
--      a cronului - recomandat explicit ca pas de precautie in raportul de
--      verificare manuala, inainte de a activa cron.schedule.
-- ---------------------------------------------------------------------------
