-- 202607290001_portfolios_metadata_seed.sql (v3)
--
-- Fata de v2: corectat calculul pozitiilor EU. In v2 alocarea EU fusese
-- calculata gresit pe baza unui capital presupus de 10.000 GBP; capitalul EU
-- ramane, conform deciziei tale, 10.000 EUR (base_currency='EUR', neschimbat
-- fata de v1/v2 in tabelul portfolios - DOAR cantitatile pozitiilor EU se
-- schimba, pentru ca alocarea per pozitie se calculeaza acum din 10.000 EUR,
-- nu din 10.000 GBP). GBP ramane moneda de raportare/comparatie in Cabinet,
-- convertita din EUR cu cursul oficial BCE din 18 mai 2026 (afisaj, nu
-- baza de calcul).
--
-- Fata de v2: Buffer Defensiv EU redus de la 12% la 6,5% (decizia ta) -
-- Nucleu European 77% + SUA/Tech 16,5% + Buffer 6,5% = 100% exact. Nu s-a
-- rescalat nimic altceva.
--
-- Pozitiile US raman neschimbate fata de v2 (nicio decizie noua pt. US).
--
-- Preturile sunt marcate explicit drept "preturi de referinta la fondare",
-- NU executii confirmate de broker - price_source='manual',
-- price_updated_at = data pretului (diferita de founded_date pentru EU).
--
-- NU insereaza (deliberat, date lipsa/nesigure sau netranzactionabile):
--  - IWFV (US, 800 GBP): pret 7 mai 2026 negasit -> ramane numerar rezervat.
--  - NOVO B (EU, 650 EUR): pret 18 mai 2026 negasit -> ramane numerar rezervat.
--  - SPCX (US 1.000 GBP + EU 600 EUR): SpaceX inca privata la ambele date de
--    referinta (IPO real 12 iunie 2026) -> ramane numerar rezervat separat,
--    pt. o eventuala tranzactie ulterioara la data reala a IPO-ului
--    (necesita raport si aprobare separata, NU face parte din acest seed).
--  - Randul "CASH" (US, 1.000 GBP) si "Buffer Defensiv" (EU, 650 EUR): numerar/
--    cvasi-numerar agregat, nu instrumente cu pret unic.
--
-- Idempotent: `on conflict (portfolio_id, ticker) do nothing` pentru
-- pozitii (necesita migrarea 202607290003 aplicata inainte, pt. cheia
-- unica); `on conflict (code) do update set founded_date` pentru portofolii.
--
-- Testat local intr-un sandbox Postgres aruncat (nu Supabase): rulare
-- initiala insereaza 2 portofolii + 6 pozitii US + 14 pozitii EU; a doua
-- rulare (idempotenta) insereaza 0 randuri noi.

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
-- US - pret de referinta 7 mai 2026 (= data fondarii). NESCHIMBAT fata de v2.
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
-- EU - pret de referinta 18 mai 2026 (fondare 17 mai, duminica). Alocare
-- calculata din capitalul real EU: 10.000 EUR (NU 10.000 GBP ca in v2). Ponderi:
-- Nucleu European 77% (13 pozitii, neschimbate individual) + SUA/Tech 16,5%
-- (3 pozitii) + Buffer 6,5% (redus de la 12%) = 100%.
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

-- Nota: NOVO B (EU, DKK, 6.5%, 650 EUR numerar rezervat), SPCX (US 1.000 GBP +
-- EU 600 EUR, numerar rezervat separat pt. tranzactie ulterioara 12 iun 2026),
-- IWFV (US, 800 GBP numerar rezervat), randul CASH (US, 1.000 GBP) si Buffer
-- Defensiv (EU, 650 EUR, redus de la 12%) raman deliberat neinserate ca
-- pozitii - vezi comentariile din antet si raportul insotitor.
