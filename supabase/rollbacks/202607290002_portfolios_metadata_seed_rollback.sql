-- 202607290002_portfolios_metadata_seed_rollback.sql (v5)
--
-- Rollback pentru seed-ul v5. Fata de rollback v4: seed-ul v5 schimba
-- complet modul de reprezentare a cash-ului (1 DEPOSIT + N BUY per
-- portofoliu, in loc de N DEPOSIT-uri; plus randuri noi in
-- portfolio_cash_reserves in loc de tranzactii) - guard-ul si delete-ul
-- sunt actualizate sa cunoasca exact aceasta forma noua.
--
-- Elimina DOAR:
--  - randurile din public.portfolio_cash_reserves introduse de seed
--    (identificate strict prin portfolio_id + categoria din lista de mai
--    jos - nu "toate rezervele portofoliului");
--  - cele 6 pozitii US si 14 pozitii EU introduse explicit de seed
--    (identificate strict prin lista de tickere de mai jos);
--  - tranzactiile introduse explicit de seed: 1 DEPOSIT (US) + 1 DEPOSIT
--    (EU) + 6 BUY (US) + 14 BUY (EU) = 22 randuri, identificate strict
--    prin forma lor exacta (DEPOSIT de 10.000 in moneda de baza a
--    portofoliului, sau BUY cu ticker din lista de mai jos) - nu "toate
--    tranzactiile portofoliului";
--  - cele 2 randuri din public.portfolios (code in ('US','EU')).
-- Nu atinge schema si nicio alta tabela.
--
-- Siguranta: daca exista dividende/istoric de performanta legate de aceste
-- portofolii, SAU orice pozitie cu un ticker din afara listei de mai jos,
-- SAU orice tranzactie care NU e una dintre cele 22 introduse de acest
-- seed (ex. un DEPOSIT de alta suma, o tranzactie SELL/WITHDRAWAL/FEE, un
-- BUY cu ticker strain), SAU orice rezerva de cash cu o categorie din
-- afara listei de mai jos, scriptul se opreste cu eroare in loc sa
-- stearga in cascada din greseala.
--
-- Impachetat in begin/commit (guard + delete in aceeasi tranzactie) - vezi
-- nota din v1 despre autocommit.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase): rollback
-- curat (sterge exact 7 rezerve + 20 pozitii + 22 tranzactii + 2
-- portofolii) si teste de siguranta separate (pozitie straina, tranzactie
-- straina, rezerva straina introduse manual -> guard-ul opreste
-- rollback-ul cu exceptie de fiecare data, fara sa stearga nimic).

begin;

do $$
declare
  seeded_tickers text[] := array['IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                                  'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL'];
  seeded_us_cash_categories text[] := array['iwfv_reserved','spcx_reserved','cash_equivalent','amplification_reserve'];
  seeded_eu_cash_categories text[] := array['novo_b_reserved','spcx_reserved','buffer_defensiv'];
  -- notez ca 'AAPL' apare in ambele portofolii (US si EU) cu tickere identice
  -- dar portfolio_id diferit - lista de mai sus e folosita per-portofoliu mai
  -- jos, deci nu exista ambiguitate. La fel, 'spcx_reserved' apare in ambele
  -- liste de categorii (US si EU), dar verificarea de mai jos e tot per-
  -- portofoliu (join pe portfolio_id), deci nu exista ambiguitate.
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
         and not (
           (pt.type = 'DEPOSIT' and pt.amount = 10000 and pt.currency = p.base_currency)
           or (pt.type = 'BUY' and pt.ticker = any(seeded_tickers))
         )
     )
     or exists (
       select 1 from public.portfolio_cash_reserves pcr
       join public.portfolios p on p.id = pcr.portfolio_id
       where p.code in ('US','EU')
         and not (
           (p.code = 'US' and pcr.category = any(seeded_us_cash_categories))
           or (p.code = 'EU' and pcr.category = any(seeded_eu_cash_categories))
         )
     )
  then
    raise exception 'Rollback oprit: exista dividende/istoric, sau pozitii/tranzactii/rezerve de cash din afara celor introduse de seed, legate de portofoliile US/EU - stergerea ar elimina in cascada date care nu au fost introduse de acest seed. Verifica manual inainte de a continua.';
  end if;
end $$;

delete from public.portfolio_cash_reserves pcr
using public.portfolios p
where p.id = pcr.portfolio_id
  and (
    (p.code = 'US' and pcr.category in ('iwfv_reserved','spcx_reserved','cash_equivalent','amplification_reserve'))
    or (p.code = 'EU' and pcr.category in ('novo_b_reserved','spcx_reserved','buffer_defensiv'))
  );

delete from public.portfolio_transactions pt
using public.portfolios p
where p.id = pt.portfolio_id
  and p.code in ('US','EU')
  and (
    (pt.type = 'DEPOSIT' and pt.amount = 10000 and pt.currency = p.base_currency)
    or (pt.type = 'BUY' and pt.ticker in ('IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                                           'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL'))
  );

delete from public.portfolio_positions pp
using public.portfolios p
where p.id = pp.portfolio_id
  and p.code in ('US','EU')
  and pp.ticker in ('IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                     'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL');

delete from public.portfolios where code in ('US', 'EU');

commit;
