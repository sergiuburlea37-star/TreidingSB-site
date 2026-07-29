-- 202607290001_portfolios_metadata_seed.sql (v4)
--
-- Fata de v3: NU s-a schimbat nicio cantitate/pret de pozitie (cele 6 pozitii
-- US si cele 14 pozitii EU raman identice, verificate din nou mai jos).
-- Corectie fata de v3: seed-ul v3 omitea complet o rezerva de numerar de
-- GBP 500 din structura portofoliului US ("rezerva separata pentru amplificarea
-- pozitiilor") - nu era nici in pozitii, nici in comentarii, nici in nicio
-- alta reprezentare. Verificare aritmetica (v3, US):
--   6 pozitii (GBP 6.700, neschimbat) + IWFV (GBP 800) + SpaceX (GBP 1.000) +
--   CASH (GBP 1.000) = GBP 9.500  -> lipseau exact GBP 500 din GBP 10.000.
-- v4 adauga aceasta suma ca inregistrare de cash, NU ca pozitie/actiune si
-- NU adaugata la valoarea vreunei pozitii cumparate (pozitiile raman identic
-- GBP 6.700 in v3 si v4).
--
-- Reprezentarea cash-ului: schema NU are un tabel/coloane dedicate pt.
-- "categorii de cash rezervat" (doar portfolio_positions pt. holdings si
-- portfolio_transactions pt. fluxuri de numerar/tranzactii) - nu a fost
-- nevoie de nicio migrare noua: public.portfolio_transactions permite deja
-- randuri fara pozitie asociata (position_id si ticker sunt nullable), deci
-- cele 4 categorii de cash US se reprezinta ca 4 tranzactii tip 'DEPOSIT',
-- separate prin `note`, fara pozitie/ticker atasat. Inserare idempotenta
-- prin verificare explicita `where not exists` (nu necesita o constrangere
-- UNIQUE noua pe portfolio_transactions).
--
-- EU: verificat, totalurile raman corecte fara nicio modificare (investit
-- EUR 8.100 + NOVO B EUR 650 rezervat + SpaceX EUR 600 rezervat + Buffer Defensiv
-- EUR 650 = EUR 10.000 exact) - nu se schimba nimic la EU in v4 (nici pozitii,
-- nici cash), ramane doar documentat in comentarii ca in v3.
--
-- Pozitiile US si EU: NESCHIMBATE fata de v3 (vezi v3 pentru istoricul
-- deciziilor de calcul - capital, ponderi, curs BCE, conventii GBX etc.).
--
-- Preturile sunt marcate explicit drept "preturi de referinta la fondare",
-- NU executii confirmate de broker - price_source='manual'.
--
-- NU insereaza (deliberat, date lipsa/nesigure sau netranzactionabile):
--  - IWFV (US, GBP 800): pret 7 mai 2026 negasit -> ramane numerar rezervat
--    (acum inregistrat explicit ca tranzactie DEPOSIT, vezi mai jos).
--  - NOVO B (EU, EUR 650): pret 18 mai 2026 negasit -> ramane numerar rezervat
--    (doar in comentarii, neschimbat fata de v3 - nu a fost cerut sa se
--    adauge o tranzactie DEPOSIT si pentru EU in aceasta corectie).
--  - SPCX (US GBP 1.000 + EU EUR 600): SpaceX inca privata la ambele date de
--    referinta (IPO real 12 iunie 2026) -> ramane numerar rezervat separat,
--    pt. o eventuala tranzactie ulterioara la data reala a IPO-ului
--    (necesita raport si aprobare separata, NU face parte din acest seed).
--    Partea US (GBP 1.000) e acum inregistrata explicit ca tranzactie DEPOSIT.
--  - Randul "CASH" (US, GBP 1.000, acum tranzactie DEPOSIT) si "Buffer
--    Defensiv" (EU, EUR 650, doar comentariu, neschimbat): numerar/cvasi-
--    numerar agregat, nu instrumente cu pret unic.
--  - Rezerva de amplificare (US, GBP 500, acum tranzactie DEPOSIT, era complet
--    omisa in v3 - vezi corectia de mai sus).
--
-- Idempotent: `on conflict (portfolio_id, ticker) do nothing` pentru
-- pozitii; `on conflict (code) do update set founded_date` pentru
-- portofolii; `where not exists (...)` pentru cele 4 tranzactii de cash US
-- (nu exista o constrangere UNIQUE pe portfolio_transactions - verificarea
-- explicita evita duplicarea la o rulare repetata).

begin;

insert into public.portfolios
  (code, name, base_currency, initial_capital, founded_date, target_return_text, risk_level, description, published)
values
  (
      'US',
      'Portofoliu US',
      'GBP',
      10000,
      '2026-05-07',
      '~7-10%/an (tinta declarata pe pagina publica, nu randament realizat)',
      'moderat',
      'Portofoliu diversificat demonstrativ, risc moderat, orizont 3-5 ani.',
      false
    ),
  (
      'EU',
      'Portofoliu European Moderat+',
      'EUR',
      10000,
      '2026-05-17',
      null,
      'moderat',
      'Strategie pe 3-5 ani, intrare in transe, control al riscului.',
      false
    )
on conflict (code) do update set
  founded_date = excluded.founded_date;

-- ---------------------------------------------------------------------------
-- US pozitii - pret de referinta 7 mai 2026 (= data fondarii). NESCHIMBAT
-- fata de v3. Total verificat: GBP 2.500 + GBP 1.000 + GBP 1.000 + GBP 700 + GBP 750 +
-- GBP 750 = GBP 6.700 exact.
-- ---------------------------------------------------------------------------
insert into public.portfolio_positions
  (portfolio_id, position_no, ticker, name, category, sector_or_market, instrument_currency,
     quantity, avg_price, current_price, price_updated_at, price_source, risk_level, group_label, sort_order)
select p.id, v.position_no, v.ticker, v.name, v.category, v.sector_or_market, v.instrument_currency,
       v.quantity, v.avg_price, v.avg_price, '2026-05-07'::timestamptz, 'manual', v.risk_level, v.group_label, v.sort_order
from public.portfolios p
join (values
    (1, 'IWDA', 'iShares Core MSCI World UCITS ETF (ISIN IE00B4L5Y983)', 'ETF', 'LSE (USD) - vezi nota ambiguitate bursa/moneda', 'USD', 24.202770::numeric, 140.80::numeric, 'Scazut', 'NUCLEU GLOBAL - ETF-uri UCITS (45%)', 1),
    (2, 'VUKE', 'Vanguard FTSE 100 UCITS ETF (ISIN IE00B810Q511)', 'ETF', 'LSE', 'GBP', 22.351363::numeric, 44.74::numeric, 'Scazut', 'NUCLEU GLOBAL - ETF-uri UCITS (45%)', 2),
    (3, 'EIMI', 'iShares Core MSCI EM IMI UCITS ETF (ISIN IE00BKM4GZ66)', 'ETF', 'LSE (USD)', 'USD', 24.756629::numeric, 55.06::numeric, 'Mediu', 'NUCLEU GLOBAL - ETF-uri UCITS (45%)', 3),
    (5, 'WSML', 'iShares MSCI World Small Cap UCITS ETF (ISIN IE00BF4RFH31)', 'ETF', 'LSE (USD)', 'USD', 93.180664::numeric, 10.24::numeric, 'Mediu', 'SATELITI FACTOR - ETF-uri Tematice (15%)', 5),
    (7, 'AAPL', 'Apple Inc.', 'Actiune', 'Nasdaq', 'USD', 3.556655::numeric, 287.44::numeric, 'Mediu', 'CRESTERE - Actiuni Individuale (25%)', 7),
    (8, 'RR.', 'Rolls-Royce Holdings (cotat LSE in GBX; 1259.00 GBX = 12.59 GBP)', 'Actiune', 'LSE', 'GBP', 59.571088::numeric, 12.59::numeric, 'Mediu', 'CRESTERE - Actiuni Individuale (25%)', 8)
  ) as v(position_no, ticker, name, category, sector_or_market, instrument_currency, quantity, avg_price, risk_level, group_label, sort_order)
  on true
where p.code = 'US'
on conflict (portfolio_id, ticker) do nothing;

-- ---------------------------------------------------------------------------
-- US cash - 4 categorii, inregistrate ca tranzactii DEPOSIT (fara pozitie/
-- ticker asociat), NU ca pozitii cumparate. Idempotent prin `not exists`.
-- Total: GBP 800 + GBP 1.000 + GBP 1.000 + GBP 500 = GBP 3.300. Impreuna cu cele 6 pozitii
-- (GBP 6.700) => GBP 10.000 exact, egal cu initial_capital.
-- ---------------------------------------------------------------------------
insert into public.portfolio_transactions
  (portfolio_id, type, amount, currency, executed_at, note)
select p.id, 'DEPOSIT', v.amount, 'GBP', '2026-05-07'::timestamptz, v.note
from public.portfolios p
join (values
    (800::numeric,  'Numerar rezervat: IWFV (pret neconfirmat la 7 mai 2026, nu este cumparat inca)'),
    (1000::numeric, 'Numerar rezervat: SpaceX/SPCX (netranzactionabila la 7 mai 2026; tranzactie separata dupa 12 iunie 2026, necesita raport si aprobare separata)'),
    (1000::numeric, 'Cash si echivalente de numerar (agregat, nu este o pozitie cu pret unic)'),
    (500::numeric,  'Rezerva separata pentru amplificarea pozitiilor existente (neinvestita inca; omisa din greseala in seed v3)')
  ) as v(amount, note) on true
where p.code = 'US'
and not exists (
    select 1 from public.portfolio_transactions pt
    where pt.portfolio_id = p.id and pt.type = 'DEPOSIT' and pt.note = v.note
  );

-- ---------------------------------------------------------------------------
-- EU pozitii - pret de referinta 18 mai 2026. NESCHIMBATE fata de v3.
-- Total verificat: EUR 8.100 exact (vezi v3 pentru detalii pe pozitie).
-- ---------------------------------------------------------------------------
insert into public.portfolio_positions
  (portfolio_id, position_no, ticker, name, category, sector_or_market, instrument_currency,
     quantity, avg_price, current_price, price_updated_at, price_source, risk_level, group_label, sort_order)
select p.id, v.position_no, v.ticker, v.name, v.category, v.sector_or_market, v.instrument_currency,
       v.quantity, v.avg_price, v.avg_price, '2026-05-18'::timestamptz, 'manual', v.risk_level, v.group_label, v.sort_order
from public.portfolios p
join (values
    (1, 'ASML', 'ASML Holding NV', 'Actiune', 'Euronext Amsterdam', 'EUR', 0.553622::numeric, 1264.40::numeric, 'Mediu', 'NUCLEU EUROPEAN (77%)', 1),
    (2, 'SAP', 'SAP SE', 'Actiune', 'Xetra Frankfurt', 'EUR', 4.396050::numeric, 147.86::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 2),
    (3, 'OR', 'L''Oreal SA', 'Actiune', 'Euronext Paris', 'EUR', 1.816404::numeric, 357.85::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 3),
    (4, 'NOVN', 'Novartis AG', 'Actiune', 'SIX Zurich', 'CHF', 5.071331::numeric, 117.20::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 4),
    (6, 'TTE', 'TotalEnergies SE', 'Actiune', 'Euronext Paris', 'EUR', 8.097670::numeric, 80.27::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 6),
    (7, 'ALV', 'Allianz SE', 'Actiune', 'Xetra Frankfurt', 'EUR', 1.573152::numeric, 381.40::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 7),
    (8, 'ITX', 'Inditex SA', 'Actiune', 'BME Madrid', 'EUR', 10.964912::numeric, 50.16::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 8),
    (9, 'ABBN', 'ABB Ltd', 'Actiune', 'SIX Zurich', 'CHF', 6.204293::numeric, 81.06::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 9),
    (10, 'SAF', 'Safran SA', 'Actiune', 'Euronext Paris', 'EUR', 2.008032::numeric, 273.90::numeric, 'Mediu', 'NUCLEU EUROPEAN (77%)', 10),
    (11, 'PRY', 'Prysmian SpA', 'Actiune', 'Borsa Italiana', 'EUR', 3.379520::numeric, 147.95::numeric, 'Mediu', 'NUCLEU EUROPEAN (77%)', 11),
    (12, 'UCB', 'UCB SA', 'Actiune', 'Euronext Bruxelles', 'EUR', 2.174859::numeric, 229.90::numeric, 'Mediu', 'NUCLEU EUROPEAN (77%)', 12),
    (13, 'INVE B', 'Investor AB', 'Actiune', 'Nasdaq Stockholm', 'SEK', 14.946068::numeric, 366.20::numeric, 'Scazut', 'NUCLEU EUROPEAN (77%)', 13),
    (15, 'AAPL', 'Apple Inc.', 'Actiune', 'Nasdaq', 'USD', 2.150954::numeric, 297.84::numeric, 'Mediu', 'SUA/TECH GLOBAL (16.5%)', 15),
    (16, 'GOOGL', 'Alphabet Inc.', 'Actiune', 'Nasdaq', 'USD', 1.467224::numeric, 396.94::numeric, 'Mediu', 'SUA/TECH GLOBAL (16.5%)', 16)
  ) as v(position_no, ticker, name, category, sector_or_market, instrument_currency, quantity, avg_price, risk_level, group_label, sort_order)
  on true
where p.code = 'EU'
on conflict (portfolio_id, ticker) do nothing;

commit;

-- Nota: NOVO B (EU, DKK, 6.5%, 650 EUR numerar rezervat, doar comentariu),
-- SPCX (EU 600 EUR numerar rezervat, doar comentariu - partea US e acum
-- tranzactie DEPOSIT), Buffer Defensiv (EU, 650 EUR, doar comentariu) raman
-- deliberat neinserate ca pozitii - vezi comentariile din antet si raportul
-- insotitor. Categoriile de cash US sunt acum inregistrate explicit ca
-- tranzactii DEPOSIT (vezi sectiunea "US cash" de mai sus).
