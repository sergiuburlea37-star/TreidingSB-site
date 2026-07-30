-- 202607300005_revoke_unsafe_portfolio_privileges.sql
--
-- Fix de securitate: revoca privilegiile structurale TRUNCATE, REFERENCES si
-- TRIGGER de la anon si authenticated pe toate cele 7 tabele ale
-- portofoliilor. Aceste privilegii NU sunt acoperite de Row Level Security
-- (RLS filtreaza doar randurile vazute/modificate prin SELECT/INSERT/UPDATE/
-- DELETE) - Supabase acorda implicit REFERENCES/TRIGGER/TRUNCATE catre
-- anon si authenticated pe orice tabel nou din schema public, independent
-- de GRANT-urile explicite din migrarile acestui proiect.
--
-- Audit efectuat in Production pe 2026-07-30, inainte de aceasta migrare:
-- pe toate cele 7 tabele, anon avea REFERENCES,TRIGGER,TRUNCATE (fara
-- SELECT/INSERT/UPDATE/DELETE), iar authenticated avea aceleasi 3 privilegii
-- structurale in plus fata de SELECT/INSERT/UPDATE/DELETE-ul necesar si
-- controlat prin RLS. PUBLIC nu avea niciun GRANT explicit pe aceste tabele
-- (revocarea de mai jos pentru PUBLIC este defensiva, no-op daca nu exista).
--
-- Aditiva/corectiva: nu modifica nicio migrare deja aplicata, nu schimba
-- nicio policy RLS, nu modifica GRANT-urile SELECT/INSERT/UPDATE/DELETE de
-- care authenticated are nevoie (raman neschimbate, controlate de RLS), si
-- nu revoca nimic de la service_role sau de la proprietarul tabelelor.

begin;

revoke truncate, references, trigger on
  public.portfolios,
  public.portfolio_positions,
  public.portfolio_transactions,
  public.portfolio_dividends,
  public.portfolio_performance_history,
  public.fx_rates,
  public.portfolio_cash_reserves
from anon;

revoke truncate, references, trigger on
  public.portfolios,
  public.portfolio_positions,
  public.portfolio_transactions,
  public.portfolio_dividends,
  public.portfolio_performance_history,
  public.fx_rates,
  public.portfolio_cash_reserves
from authenticated;

revoke all on
  public.portfolios,
  public.portfolio_positions,
  public.portfolio_transactions,
  public.portfolio_dividends,
  public.portfolio_performance_history,
  public.fx_rates,
  public.portfolio_cash_reserves
from public;

commit;
