-- 202607290002_portfolios_metadata_seed_rollback.sql
--
-- Rollback pentru 202607290001_portfolios_metadata_seed.sql.
-- Elimina DOAR cele 2 randuri introduse de acel seed (identificate prin
-- `code in ('US','EU')`), fara sa atinga schema (tabele/policy/functii) si
-- fara sa atinga vreo alta tabela.
--
-- Siguranta: daca intre timp au fost adaugate pozitii/tranzactii/dividende
-- reale (prin Admin sau alta migrare), acest script se opreste cu o eroare
-- explicita in loc sa le stearga in cascada din greseala - verifica manual
-- inainte de a continua intr-un asemenea caz.

-- ATENTIE: guard-ul si delete-ul TREBUIE sa ruleze in aceeasi tranzactie -
-- daca sunt trimise ca statement-uri separate cu autocommit (ex. `psql -f`
-- fara `-1`), un exception in blocul `do $$` NU opreste delete-ul de mai jos
-- (fiecare statement se confirma individual). De aceea tot scriptul e
-- impachetat explicit in begin/commit.
begin;

do $$
begin
  if exists (select 1 from public.portfolio_positions pp join public.portfolios p on p.id = pp.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_transactions pt join public.portfolios p on p.id = pt.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_dividends pd join public.portfolios p on p.id = pd.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_performance_history ph join public.portfolios p on p.id = ph.portfolio_id where p.code in ('US','EU'))
  then
    raise exception 'Rollback oprit: exista deja pozitii/tranzactii/dividende/istoric legate de portofoliile US/EU - stergerea ar elimina in cascada date care nu au fost introduse de seed-ul de metadate. Verifica manual inainte de a continua.';
  end if;
end $$;

delete from public.portfolios where code in ('US', 'EU');

commit;
