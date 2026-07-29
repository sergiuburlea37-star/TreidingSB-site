-- 202607290002_portfolios_metadata_seed_rollback.sql (v3)
--
-- Rollback pentru seed-ul v3. Fata de rollback-ul v2: NICIO schimbare de
-- logica - lista de tickere introdusi de seed e identica intre v2 si v3
-- (doar cantitatile s-au recalculat in v3, ca urmare a corectiei capitalului
-- EU la 10.000 EUR si a reducerii bufferului la 6.5% - vezi v3 al seed-ului).
-- Elimina DOAR:
--  - cele 6 pozitii US si 14 pozitii EU introduse explicit de seed-ul v3
--    (identificate strict prin lista de tickere de mai jos, NU "toate
--    pozitiile portofoliului" - asta ca sa nu stearga din greseala pozitii
--    adaugate ulterior manual, ex. IWFV/NOVO B/SPCX odata ce vor avea preturi);
--  - cele 2 randuri din public.portfolios (code in ('US','EU')).
-- Nu atinge schema (tabele/policy/functii/constrangeri) si nicio alta tabela.
--
-- Siguranta: daca exista tranzactii/dividende/istoric de performanta legate
-- de aceste portofolii, SAU orice pozitie cu un ticker din afara listei de
-- mai jos (adica adaugata separat, nu de acest seed), scriptul se opreste
-- cu eroare in loc sa stearga in cascada din greseala.
--
-- Impachetat in begin/commit (guard + delete in aceeasi tranzactie) - vezi
-- nota din v1 despre autocommit.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase): rollback
-- curat (sterge exact 20 pozitii + 2 portofolii) si test de siguranta
-- (pozitie straina introdusa manual -> guard-ul opreste rollback-ul cu
-- exceptie, fara sa stearga nimic).

begin;

do $$
declare
  seeded_tickers text[] := array['IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                                    'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL'];
  -- notez ca 'AAPL' apare in ambele portofolii (US si EU) cu tickere identice
  -- dar portfolio_id diferit - lista de mai sus e folosita per-portofoliu mai
  -- jos, deci nu exista ambiguitate.
begin
  if exists (select 1 from public.portfolio_transactions pt join public.portfolios p on p.id = pt.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_dividends pd join public.portfolios p on p.id = pd.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_performance_history ph join public.portfolios p on p.id = ph.portfolio_id where p.code in ('US','EU'))
     or exists (
         select 1 from public.portfolio_positions pp
         join public.portfolios p on p.id = pp.portfolio_id
         where p.code in ('US','EU') and not (pp.ticker = any(seeded_tickers))
       )
  then
    raise exception 'Rollback oprit: exista tranzactii/dividende/istoric, sau pozitii cu tickere din afara listei introduse de seed, legate de portofoliile US/EU - stergerea ar elimina in cascada date care nu au fost introduse de acest seed. Verifica manual inainte de a continua.';
  end if;
end $$;

delete from public.portfolio_positions pp
using public.portfolios p
where p.id = pp.portfolio_id
  and p.code in ('US','EU')
  and pp.ticker in ('IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                       'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL');

delete from public.portfolios where code in ('US', 'EU');

commit;
