-- 202607290002_portfolios_metadata_seed_rollback.sql (v4)
--
-- Rollback pentru seed-ul v4. Fata de rollback v3: seed-ul v4 adauga 4
-- tranzactii DEPOSIT (cash US), asa ca guard-ul si delete-ul trebuie extinse
-- sa cunoasca aceste randuri (altfel guard-ul original ar bloca rollback-ul
-- pe orice tranzactie existenta, inclusiv cele introduse legitim de seed).
--
-- Elimina DOAR:
--  - cele 6 pozitii US si 14 pozitii EU introduse explicit de seed
--    (identificate strict prin lista de tickere de mai jos);
--  - cele 4 tranzactii DEPOSIT de cash US introduse explicit de seed
--    (identificate strict prin portfolio_id + type='DEPOSIT' + note din
--    lista de mai jos - nu "toate tranzactiile portofoliului");
--  - cele 2 randuri din public.portfolios (code in ('US','EU')).
-- Nu atinge schema si nicio alta tabela.
--
-- Siguranta: daca exista dividende/istoric de performanta legate de aceste
-- portofolii, SAU orice pozitie cu un ticker din afara listei de mai jos,
-- SAU orice tranzactie care NU este una dintre cele 4 tranzactii DEPOSIT de
-- cash US introduse de acest seed (ex. o tranzactie EU, o tranzactie de alt
-- tip, sau o tranzactie DEPOSIT cu alt note), scriptul se opreste cu eroare
-- in loc sa stearga in cascada din greseala.
--
-- Impachetat in begin/commit (guard + delete in aceeasi tranzactie) - vezi
-- nota din v1 despre autocommit.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase): rollback
-- curat (sterge exact 20 pozitii + 4 tranzactii + 2 portofolii) si test de
-- siguranta (pozitie straina + tranzactie straina introduse manual -> guard-
-- ul opreste rollback-ul cu exceptie, fara sa stearga nimic).

begin;

do $$
declare
  seeded_tickers text[] := array['IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                                    'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL'];
  seeded_cash_notes text[] := array[
        'Numerar rezervat: IWFV (pret neconfirmat la 7 mai 2026, nu este cumparat inca)',
        'Numerar rezervat: SpaceX/SPCX (netranzactionabila la 7 mai 2026; tranzactie separata dupa 12 iunie 2026, necesita raport si aprobare separata)',
        'Cash si echivalente de numerar (agregat, nu este o pozitie cu pret unic)',
        'Rezerva separata pentru amplificarea pozitiilor existente (neinvestita inca; omisa din greseala in seed v3)'
      ];
  -- notez ca 'AAPL' apare in ambele portofolii (US si EU) cu tickere identice
  -- dar portfolio_id diferit - lista de mai sus e folosita per-portofoliu mai
  -- jos, deci nu exista ambiguitate.
begin
  if exists (select 1 from public.portfolio_dividends pd join public.portfolios p on p.id = pd.portfolio_id where p.code in ('US','EU'))
     or exists (select 1 from public.portfolio_performance_history ph join public.portfolios p on p.id = ph.portfolio_id where p.code in ('US','EU'))
     or exists (
         select 1 from public.portfolio_positions pp
         join public.portfolios p on p.id = pp.portfolio_id
         where p.code in ('US','EU') and not (pp.ticker = any(seeded_tickers))
       )
     or exists (
         select 1 from public.portfolio_transactions pt
         join public.portfolios p on p.id = pt.portfolio_id
         where p.code in ('US','EU')
           and not (p.code = 'US' and pt.type = 'DEPOSIT' and pt.note = any(seeded_cash_notes))
       )
  then
    raise exception 'Rollback oprit: exista dividende/istoric, sau pozitii/tranzactii din afara listei introduse de seed, legate de portofoliile US/EU - stergerea ar elimina in cascada date care nu au fost introduse de acest seed. Verifica manual inainte de a continua.';
  end if;
end $$;

delete from public.portfolio_positions pp
using public.portfolios p
where p.id = pp.portfolio_id
  and p.code in ('US','EU')
  and pp.ticker in ('IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                       'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL');

delete from public.portfolio_transactions pt
using public.portfolios p
where p.id = pt.portfolio_id
  and p.code = 'US'
  and pt.type = 'DEPOSIT'
  and pt.note in (
      'Numerar rezervat: IWFV (pret neconfirmat la 7 mai 2026, nu este cumparat inca)',
      'Numerar rezervat: SpaceX/SPCX (netranzactionabila la 7 mai 2026; tranzactie separata dupa 12 iunie 2026, necesita raport si aprobare separata)',
      'Cash si echivalente de numerar (agregat, nu este o pozitie cu pret unic)',
      'Rezerva separata pentru amplificarea pozitiilor existente (neinvestita inca; omisa din greseala in seed v3)'
    );

delete from public.portfolios where code in ('US', 'EU');

commit;
