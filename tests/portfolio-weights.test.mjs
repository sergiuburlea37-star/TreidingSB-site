// tests/portfolio-weights.test.mjs
//
// Teste pentru api/_lib/fx-convert.js, cu accent pe cerinta explicita:
// "calculul ponderii initiale trebuie sa aleaga cursul din data tranzactiei,
// respectiv 7 mai 2026, nu cel mai recent curs disponibil din 18 mai" si
// "daca nu exista curs exact in ziua tranzactiei, foloseste numai cel mai
// recent curs oficial anterior sau egal cu data tranzactiei, niciodata un
// curs ulterior".
//
// Ruleaza cu: node --test tests/
// Fara dependente noi (node:test + node:assert/strict sunt built-in din
// Node 18+, disponibile in tot ce ruleaza pe Vercel Node runtime).
//
// IMPORTANT - ce testeaza si ce NU testeaza acest fisier:
//   - Testeaza createFxConverter (functii pure, fara Supabase/HTTP) - AL
//     ACELUIASI cod folosit de api/account-portfolios.js (import direct din
//     api/_lib/fx-convert.js, nu o copie).
//   - Cursurile 2026-05-07 (EUR/USD 1.1770, EUR/GBP 0.8641) folosite in
//     fixture-urile de mai jos sunt cele din
//     supabase/seeds/202607300007_fx_rates_us_may2026_seed.sql - PREGATIT,
//     dar NEEXECUTAT inca in Supabase. Testele demonstreaza ce se va
//     intampla DUPA ce seed-ul va fi aprobat si rulat (grupul "cu seed 7
//     mai"), separat de comportamentul REAL curent, fara acel seed (grupul
//     "fara seed 7 mai, doar 18 mai") - vezi mai jos.
//   - Nu ating Supabase, nu fac niciun apel de retea.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFxConverter } from '../api/_lib/fx-convert.js';

// -----------------------------------------------------------------------
// Fixtures - replica exacta a datelor relevante din
// supabase/seeds/202607290001_portfolios_metadata_seed.sql (pozitii US) si
// supabase/seeds/202607300006_fx_rates_eu_may2026_seed.sql (cursuri EU,
// deja mergeuite pe main) + 202607300007_fx_rates_us_may2026_seed.sql
// (cursuri US, pregatite dar neexecutate).
// -----------------------------------------------------------------------

const FX_ROWS_EU_ONLY = [
  // deja mergeuit pe main (202607300006) - fondarea portofoliului EU
  { base_currency: 'EUR', quote_currency: 'CHF', rate: 0.9144, as_of_date: '2026-05-18' },
  { base_currency: 'EUR', quote_currency: 'SEK', rate: 10.9465, as_of_date: '2026-05-18' },
  { base_currency: 'EUR', quote_currency: 'USD', rate: 1.1648, as_of_date: '2026-05-18' },
  { base_currency: 'EUR', quote_currency: 'GBP', rate: 0.8702, as_of_date: '2026-05-18' }
];

const FX_ROWS_WITH_US_SEED = [
  ...FX_ROWS_EU_ONLY,
  // 202607300007_fx_rates_us_may2026_seed.sql - PREGATIT, NEEXECUTAT
  { base_currency: 'EUR', quote_currency: 'USD', rate: 1.1770, as_of_date: '2026-05-07' },
  { base_currency: 'EUR', quote_currency: 'GBP', rate: 0.8641, as_of_date: '2026-05-07' }
];

// Tranzactii BUY US - suma = round(quantity * avg_price, 2), IDENTIC cu
// formula din portfolios_metadata_seed.sql. Toate executate 2026-05-07
// (price_updated_at al pozitiilor US in seed).
const US_BUYS = [
  { ticker: 'IWDA', amount: 3407.75, currency: 'USD', executed_at: '2026-05-07T00:00:00+00:00' },
  { ticker: 'VUKE', amount: 1000.00, currency: 'GBP', executed_at: '2026-05-07T00:00:00+00:00' },
  { ticker: 'EIMI', amount: 1363.10, currency: 'USD', executed_at: '2026-05-07T00:00:00+00:00' },
  { ticker: 'WSML', amount: 954.17, currency: 'USD', executed_at: '2026-05-07T00:00:00+00:00' },
  { ticker: 'AAPL', amount: 1022.32, currency: 'USD', executed_at: '2026-05-07T00:00:00+00:00' },
  { ticker: 'RR.', amount: 750.00, currency: 'GBP', executed_at: '2026-05-07T00:00:00+00:00' }
];

const US_INITIAL_CAPITAL = 10000; // GBP

function initialWeightPct(buys, initialCapital, converter, baseCurrency) {
  const converted = buys.map((t) =>
    converter.convertAsOf(t.amount, t.currency, baseCurrency, t.executed_at.slice(0, 10))
  );
  const complete = converted.every((v) => v != null);
  if (!complete) return null;
  const sum = converted.reduce((a, v) => a + v, 0);
  return (sum / initialCapital) * 100;
}

describe('convertAsOf - regula "niciodata un curs ulterior datei tranzactiei"', () => {
  test('foloseste cursul EXACT de la targetDate cand exista', () => {
    const c = createFxConverter(FX_ROWS_WITH_US_SEED);
    // 100 USD -> GBP la 2026-05-07 trebuie sa foloseasca EXACT cursurile de
    // 7 mai (0.8641 / 1.1770), NU cele de 18 mai (0.8702 / 1.1648).
    const viaAsOf = c.convertAsOf(100, 'USD', 'GBP', '2026-05-07');
    const expected = 100 * (0.8641 / 1.1770);
    assert.ok(Math.abs(viaAsOf - expected) < 1e-9, `asteptat ~${expected}, primit ${viaAsOf}`);
  });

  test('NICIODATA nu foloseste un curs cu data ulterioara targetDate', () => {
    // Doar cursul de 18 mai exista; cerem conversia la o data ANTERIOARA lui
    // (1 mai) - trebuie sa returneze null, nu cursul de 18 mai.
    const c = createFxConverter(FX_ROWS_EU_ONLY);
    const result = c.convertAsOf(100, 'USD', 'GBP', '2026-05-01');
    assert.equal(result, null, 'convertAsOf nu trebuie sa "imprumute" un curs ulterior datei tinta');
  });

  test('foloseste cel mai recent curs ANTERIOR cand nu exista curs exact la targetDate', () => {
    const rows = [
      { base_currency: 'EUR', quote_currency: 'USD', rate: 1.10, as_of_date: '2026-05-01' },
      { base_currency: 'EUR', quote_currency: 'GBP', rate: 0.85, as_of_date: '2026-05-01' },
      { base_currency: 'EUR', quote_currency: 'USD', rate: 1.20, as_of_date: '2026-05-10' }, // ulterior targetDate - NU trebuie folosit
      { base_currency: 'EUR', quote_currency: 'GBP', rate: 0.90, as_of_date: '2026-05-10' }
    ];
    const c = createFxConverter(rows);
    const result = c.convertAsOf(100, 'USD', 'GBP', '2026-05-07'); // fara curs exact la 05-07
    const expectedUsing0501 = 100 * (0.85 / 1.10); // trebuie sa foloseasca 1 mai, NU 10 mai
    assert.ok(Math.abs(result - expectedUsing0501) < 1e-9, `trebuia sa foloseasca cursul din 2026-05-01, a rezultat ${result}`);
  });

  test('convert() (cel mai recent, fara restrictie de data) ramane comportamentul vechi - pentru valoare/cash CURENT', () => {
    const c = createFxConverter(FX_ROWS_WITH_US_SEED);
    // convert() ignora targetDate complet si ia cel mai recent curs global (18 mai)
    const result = c.convert(100, 'USD', 'GBP');
    const expected = 100 * (0.8702 / 1.1648);
    assert.ok(Math.abs(result - expected) < 1e-9);
  });
});

describe('Pondere initiala US - CU seed-ul 2026-05-07 aplicat (202607300007, propus)', () => {
  const converter = createFxConverter(FX_ROWS_WITH_US_SEED);
  const weights = Object.fromEntries(
    US_BUYS.map((t) => [t.ticker, initialWeightPct([t], US_INITIAL_CAPITAL, converter, 'GBP')])
  );

  test('IWDA ≈ 25%', () => {
    assert.ok(Math.abs(weights.IWDA - 25) < 0.2, `IWDA = ${weights.IWDA}`);
  });
  test('VUKE = 10% (exact, GBP->GBP, fara conversie)', () => {
    assert.ok(Math.abs(weights.VUKE - 10) < 1e-9, `VUKE = ${weights.VUKE}`);
  });
  test('EIMI ≈ 10%', () => {
    assert.ok(Math.abs(weights.EIMI - 10) < 0.2, `EIMI = ${weights.EIMI}`);
  });
  test('WSML ≈ 7%', () => {
    assert.ok(Math.abs(weights.WSML - 7) < 0.2, `WSML = ${weights.WSML}`);
  });
  test('AAPL ≈ 7.5%', () => {
    assert.ok(Math.abs(weights.AAPL - 7.5) < 0.2, `AAPL = ${weights.AAPL}`);
  });
  test('RR. = 7.5% (exact, GBP->GBP, fara conversie)', () => {
    assert.ok(Math.abs(weights['RR.'] - 7.5) < 1e-9, `RR. = ${weights['RR.']}`);
  });
  test('suma celor 6 ponderi ≈ 67% (6700/10000)', () => {
    const total = Object.values(weights).reduce((a, v) => a + v, 0);
    assert.ok(Math.abs(total - 67) < 0.5, `total = ${total}`);
  });
});

describe('Pondere initiala US - FARA seed-ul 2026-05-07 (starea REALA curenta in Production)', () => {
  // Reflecta exact ce se va afisa pana la aprobarea si rularea seed-ului:
  // fx_rates are doar cursuri din 18 mai (ulterioare tranzactiilor US din
  // 7 mai) - convertAsOf nu are voie sa le foloseasca, deci pozitiile USD
  // raman "curs indisponibil" (null), NU o valoare aproximativa.
  const converter = createFxConverter(FX_ROWS_EU_ONLY);
  const weights = Object.fromEntries(
    US_BUYS.map((t) => [t.ticker, initialWeightPct([t], US_INITIAL_CAPITAL, converter, 'GBP')])
  );

  test('IWDA (USD) = null - "curs indisponibil", nu o aproximare din 18 mai', () => {
    assert.equal(weights.IWDA, null);
  });
  test('EIMI (USD) = null', () => {
    assert.equal(weights.EIMI, null);
  });
  test('WSML (USD) = null', () => {
    assert.equal(weights.WSML, null);
  });
  test('AAPL (USD) = null', () => {
    assert.equal(weights.AAPL, null);
  });
  test('VUKE (GBP, fara conversie) tot 10% - neafectat de lipsa cursului USD', () => {
    assert.ok(Math.abs(weights.VUKE - 10) < 1e-9, `VUKE = ${weights.VUKE}`);
  });
  test('RR. (GBP, fara conversie) tot 7.5% - neafectat de lipsa cursului USD', () => {
    assert.ok(Math.abs(weights['RR.'] - 7.5) < 1e-9, `RR. = ${weights['RR.']}`);
  });
});

describe('Regresie EU - conversiile existente raman neschimbate', () => {
  const converter = createFxConverter(FX_ROWS_WITH_US_SEED);

  test('ASML (EUR, fara conversie) - suma BUY 700 EUR, capital initial EU 10000 EUR => 7%', () => {
    const w = initialWeightPct(
      [{ amount: 700, currency: 'EUR', executed_at: '2026-05-18T00:00:00+00:00' }],
      10000,
      converter,
      'EUR'
    );
    assert.ok(Math.abs(w - 7) < 1e-9, `ASML weight = ${w}`);
  });

  test('NOVN (CHF->EUR la 2026-05-18) foloseste cursul EUR/CHF de 18 mai, neschimbat', () => {
    const result = converter.convertAsOf(594.36, 'CHF', 'EUR', '2026-05-18');
    const expected = 594.36 / 0.9144; // 1 EUR = 0.9144 CHF
    assert.ok(Math.abs(result - expected) < 1e-6, `NOVN convertit = ${result}, asteptat ${expected}`);
  });

  test('INVE B (SEK->EUR la 2026-05-18) foloseste cursul EUR/SEK de 18 mai, neschimbat', () => {
    const result = converter.convertAsOf(5473.25, 'SEK', 'EUR', '2026-05-18');
    const expected = 5473.25 / 10.9465;
    assert.ok(Math.abs(result - expected) < 1e-6, `INVE B convertit = ${result}, asteptat ${expected}`);
  });
});
