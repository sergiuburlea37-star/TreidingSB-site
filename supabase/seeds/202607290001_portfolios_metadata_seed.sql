-- 202607290001_portfolios_metadata_seed.sql (v5)
--
-- Fata de v4: model contabil corectat. v4 inregistra cele 4 categorii de
-- cash US ca 4 tranzactii DEPOSIT separate - gresit, pentru ca nu sunt 4
-- depuneri externe reale, ci categorii ale UNUI singur capital initial.
-- Ar fi falsificat istoricul contributiilor (o interogare "cate depozite a
-- facut membrul" ar fi aratat 4 in loc de 1). Corectat astfel:
--
-- 1. O SINGURA tranzactie DEPOSIT per portofoliu, egala cu capitalul
--    initial real (GBP 10.000 pt. US la 7 mai 2026; EUR 10.000 pt. EU la
--    17 mai 2026 - data fondarii, nu data de referinta a preturilor).
-- 2. Cate o tranzactie BUY pentru fiecare din cele 20 de pozitii
--    importate, cu cantitate/pret/suma preluate DIRECT din randul de
--    pozitie deja inserat (nu retastate - evita orice divergenta intre
--    portfolio_positions si portfolio_transactions).
-- 3. Cash-ul ramas dupa BUY-uri (GBP 3.300 pt. US, EUR 1.900 pt. EU) NU
--    mai e inregistrat ca tranzactii DEPOSIT separate, ci ca randuri in
--    noul tabel public.portfolio_cash_reserves (vezi migrarea
--    202607290004_add_portfolio_cash_reserves.sql) - un tabel dedicat
--    exclusiv etichetarii scopului cash-ului, nu miscarilor de cash.
--    Suma rezervelor (GBP 3.300 / EUR 1.900) e o RECONCILIERE cu cash-ul
--    calculat din ledger, nu o suma separata care s-ar aduna la NAV.
--
-- Pozitiile (6 US, 14 EU) raman IDENTICE fata de v3/v4 - nicio cantitate,
-- niciun pret schimbat. Verificat din nou: US GBP 6.700, EU EUR 8.100.
--
-- NU insereaza (deliberat, date lipsa/nesigure sau netranzactionabile):
--  - IWFV (US, GBP 800): pret 7 mai 2026 negasit -> ramane in
--    portfolio_cash_reserves, NU ca BUY.
--  - NOVO B (EU, EUR 650): pret 18 mai 2026 negasit -> ramane in
--    portfolio_cash_reserves, NU ca BUY.
--  - SPCX (US GBP 1.000 + EU EUR 600): SpaceX inca privata la ambele date
--    de referinta (IPO real 12 iunie 2026) -> ramane in
--    portfolio_cash_reserves, pt. o eventuala tranzactie ulterioara la
--    data reala a IPO-ului (necesita raport si aprobare separata, NU
--    face parte din acest seed).
--  - "Cash si echivalente de numerar" (US, GBP 1.000) si "Buffer
--    Defensiv" (EU, EUR 650): numerar/cvasi-numerar agregat, in
--    portfolio_cash_reserves, nu instrumente cu pret unic.
--  - Rezerva de amplificare (US, GBP 500): in portfolio_cash_reserves.
--
-- Preturile sunt marcate explicit drept "preturi de referinta la fondare",
-- NU executii confirmate de broker - price_source='manual' pe pozitii.
--
-- Idempotent:
--  - portofolii: `on conflict (code) do update set founded_date`;
--  - pozitii: `on conflict (portfolio_id, ticker) do nothing`;
--  - DEPOSIT: `where not exists` (portfolio_id, type='DEPOSIT') - un
--    singur depozit per portofoliu, nu se dubleaza la rulari repetate;
--  - BUY: `where not exists` (position_id, type='BUY') - cate o singura
--    tranzactie BUY per pozitie;
--  - cash reserves: `on conflict (portfolio_id, category) do nothing`
--    (constrangere UNIQUE reala, adaugata in migrarea 202607290004).
--
-- NECESITA migrarea 202607290004_add_portfolio_cash_reserves.sql aplicata
-- inainte (adauga tabelul public.portfolio_cash_reserves).

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
-- fata de v3/v4. Total verificat: GBP 2.500 + GBP 1.000 + GBP 1.000 +
-- GBP 700 + GBP 750 + GBP 750 = GBP 6.700 exact.
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
-- EU pozitii - pret de referinta 18 mai 2026. NESCHIMBATE fata de v3/v4.
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

-- ---------------------------------------------------------------------------
-- Contributie initiala - O SINGURA tranzactie DEPOSIT per portofoliu,
-- egala cu capitalul initial real. NU se mai folosesc tranzactii DEPOSIT
-- pentru categoriile de cash (vezi portfolio_cash_reserves mai jos).
-- ---------------------------------------------------------------------------
insert into public.portfolio_transactions
  (portfolio_id, type, amount, currency, executed_at, note)
select p.id, 'DEPOSIT', 10000::numeric, p.base_currency,
       case p.code when 'US' then '2026-05-07'::timestamptz else '2026-05-17'::timestamptz end,
       'Contributie initiala de capital'
from public.portfolios p
where p.code in ('US', 'EU')
and not exists (
  select 1 from public.portfolio_transactions pt
  where pt.portfolio_id = p.id and pt.type = 'DEPOSIT'
);

-- ---------------------------------------------------------------------------
-- Achizitii initiale - cate o tranzactie BUY per pozitie, cu
-- cantitate/pret/suma preluate DIRECT din portfolio_positions (nu
-- retastate), ca sa nu poata diverge de valoarea pozitiei. Suma BUY-urilor
-- e egala cu valoarea pozitiilor: US GBP 6.700, EU EUR 8.100.
-- ---------------------------------------------------------------------------
insert into public.portfolio_transactions
  (portfolio_id, position_id, ticker, type, quantity, price, amount, currency, executed_at, note)
select pp.portfolio_id, pp.id, pp.ticker, 'BUY', pp.quantity, pp.avg_price,
       round(pp.quantity * pp.avg_price, 2), pp.instrument_currency, pp.price_updated_at,
       'Achizitie initiala - pozitie importata din seed (pret de referinta la fondare)'
from public.portfolio_positions pp
join public.portfolios p on p.id = pp.portfolio_id
where p.code in ('US', 'EU')
  and pp.ticker in ('IWDA','VUKE','EIMI','WSML','AAPL','RR.',
                     'ASML','SAP','OR','NOVN','TTE','ALV','ITX','ABBN','SAF','PRY','UCB','INVE B','GOOGL')
and not exists (
  select 1 from public.portfolio_transactions pt
  where pt.position_id = pp.id and pt.type = 'BUY'
);

-- ---------------------------------------------------------------------------
-- Rezerve de cash - US: 4 categorii (GBP 3.300 total). Reprezentate in
-- portfolio_cash_reserves, NU ca tranzactii. Egal cu cash-ul ramas dupa
-- DEPOSIT (GBP 10.000) minus BUY-urile US (GBP 6.700).
-- ---------------------------------------------------------------------------
insert into public.portfolio_cash_reserves
  (portfolio_id, category, amount, currency, reserved_for_ticker, status, note)
select p.id, v.category, v.amount, v.currency, v.reserved_for_ticker, 'reserved', v.note
from public.portfolios p
join (values
  ('iwfv_reserved', 800::numeric, 'GBP', 'IWFV', 'Numerar rezervat pentru IWFV - pret neconfirmat la 7 mai 2026, nu este cumparat inca'),
  ('spcx_reserved', 1000::numeric, 'GBP', 'SPCX', 'Numerar rezervat pentru SpaceX/SPCX - netranzactionabila la 7 mai 2026; tranzactie separata dupa 12 iunie 2026, necesita raport si aprobare separata'),
  ('cash_equivalent', 1000::numeric, 'GBP', null, 'Cash si echivalente de numerar (agregat, nu este o pozitie cu pret unic)'),
  ('amplification_reserve', 500::numeric, 'GBP', null, 'Rezerva separata pentru amplificarea pozitiilor existente (neinvestita inca; omisa din greseala in seed v3)')
) as v(category, amount, currency, reserved_for_ticker, note)
  on true
where p.code = 'US'
on conflict (portfolio_id, category) do nothing;

-- ---------------------------------------------------------------------------
-- Rezerve de cash - EU: 3 categorii (EUR 1.900 total). Egal cu cash-ul
-- ramas dupa DEPOSIT (EUR 10.000) minus BUY-urile EU (EUR 8.100).
-- ---------------------------------------------------------------------------
insert into public.portfolio_cash_reserves
  (portfolio_id, category, amount, currency, reserved_for_ticker, status, note)
select p.id, v.category, v.amount, v.currency, v.reserved_for_ticker, 'reserved', v.note
from public.portfolios p
join (values
  ('novo_b_reserved', 650::numeric, 'EUR', 'NOVO B', 'Numerar rezervat pentru NOVO B - pret neconfirmat la 18 mai 2026, nu este cumparat inca'),
  ('spcx_reserved', 600::numeric, 'EUR', 'SPCX', 'Numerar rezervat pentru SpaceX/SPCX - netranzactionabila la 18 mai 2026; tranzactie separata dupa 12 iunie 2026, necesita raport si aprobare separata'),
  ('buffer_defensiv', 650::numeric, 'EUR', null, 'Buffer Defensiv (agregat ETF/Cash/MMF/Obligatiuni, nu este o pozitie cu pret unic)')
) as v(category, amount, currency, reserved_for_ticker, note)
  on true
where p.code = 'EU'
on conflict (portfolio_id, category) do nothing;

commit;
