-- 202608140001_provider_symbol_seed.sql
--
-- Mapare initiala EODHD pentru cele 20 de pozitii deja seed-uite in
-- supabase/seeds/202607290001_portfolios_metadata_seed.sql (6 US + 14 EU,
-- 19 provider_symbol distincte - AAPL e detinut separat de ambele
-- portofolii, acelasi cod EODHD 'AAPL.US' pentru amandoua).
--
-- NECESITA migrarea 202608140001_add_provider_symbol_mapping.sql aplicata
-- inainte (adauga coloanele provider_symbol / provider_price_multiplier).
--
-- Ticker-ele folosite mai jos sunt EXACT cele stocate in portfolio_positions
-- (verificate din 202607290001_portfolios_metadata_seed.sql, nu presupuse):
-- 'RR.' (cu punct final, NU 'RR') si 'INVE B' (cu spatiu, NU 'INVE-B') -
-- un update cu ticker-ul gresit ar afecta tacit 0 randuri.
--
-- Multiplicator 0.01 (GBX -> GBP) DOAR pt. VUKE si RR. (ambele LSE,
-- cotate in pence) - restul raman la valoarea implicita 1 din migrarea
-- schemei.
--
-- provider_symbol pentru INVE B ('INVE-B.ST') e cel indicat de proiect, dar
-- TREBUIE reverificat manual fata de abonamentul EODHD real inainte de
-- productie (formatul exact pt. clase de actiuni pe Nasdaq Stockholm poate
-- diferi intre furnizori) - vezi pasul 3 din procesul de verificare manuala
-- insotitor.
--
-- Idempotenta: fiecare UPDATE tinteste exact un rand existent (portfolio_id,
-- ticker) - rerularea seed-ului doar rescrie aceleasi valori, nu insereaza
-- randuri noi si nu are efecte secundare.
--
-- NU se executa automat. Rulare manuala dupa aprobare, DUPA migrarea
-- schemei de mai sus.

begin;

update public.portfolio_positions pp
set provider_symbol = v.provider_symbol,
    provider_price_multiplier = v.provider_price_multiplier
from public.portfolios p,
     (values
        ('US', 'IWDA',    'IWDA.LSE',  1::numeric),
        ('US', 'VUKE',    'VUKE.LSE',  0.01::numeric),
        ('US', 'EIMI',    'EIMI.LSE',  1::numeric),
        ('US', 'WSML',    'WSML.LSE',  1::numeric),
        ('US', 'AAPL',    'AAPL.US',   1::numeric),
        ('US', 'RR.',     'RR.LSE',    0.01::numeric),
        ('EU', 'ASML',    'ASML.AS',     1::numeric),
        ('EU', 'SAP',     'SAP.XETRA',   1::numeric),
        ('EU', 'OR',      'OR.PA',       1::numeric),
        ('EU', 'NOVN',    'NOVN.SW',     1::numeric),
        ('EU', 'TTE',     'TTE.PA',      1::numeric),
        ('EU', 'ALV',     'ALV.XETRA',   1::numeric),
        ('EU', 'ITX',     'ITX.MC',      1::numeric),
        ('EU', 'ABBN',    'ABBN.SW',     1::numeric),
        ('EU', 'SAF',     'SAF.PA',      1::numeric),
        ('EU', 'PRY',     'PRY.MI',      1::numeric),
        ('EU', 'UCB',     'UCB.BR',      1::numeric),
        ('EU', 'INVE B',  'INVE-B.ST',   1::numeric),
        ('EU', 'AAPL',    'AAPL.US',     1::numeric),
        ('EU', 'GOOGL',   'GOOGL.US',    1::numeric)
     ) as v(portfolio_code, ticker, provider_symbol, provider_price_multiplier)
where p.code = v.portfolio_code
  and pp.portfolio_id = p.id
  and pp.ticker = v.ticker;

commit;

-- ---------------------------------------------------------------------------
-- Verificare manuala dupa rulare (NU face parte din migrare) - trebuie sa
-- returneze 0 randuri; orice rand aparut aici e o pozitie ACTIVA nemapata,
-- care va forta orice run de sincronizare viitor sa fie "partial":
--
-- select id, portfolio_id, ticker
-- from public.portfolio_positions
-- where active and provider_symbol is null;
-- ---------------------------------------------------------------------------
