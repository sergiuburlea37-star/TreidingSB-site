import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mappingSql = readFileSync(new URL('../supabase/seeds/202608140001_provider_symbol_seed.sql', import.meta.url), 'utf8');
const positionsSql = readFileSync(new URL('../supabase/seeds/202607290001_portfolios_metadata_seed.sql', import.meta.url), 'utf8');

function parseMappings(sql) {
  const rows = [];
  const tuple = /\('(?:US|EU)'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*(?:0\.01|1)::numeric\)/g;
  for (const raw of sql.match(tuple) || []) {
    const match = raw.match(/\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([0-9.]+)::numeric\)/);
    if (match) rows.push({ portfolioCode: match[1], ticker: match[2], providerSymbol: match[3], multiplier: Number(match[4]) });
  }
  return rows;
}

function parsePositionTickers(sql, code) {
  const marker = code === 'US' ? '-- US pozitii' : '-- EU pozitii';
  const start = sql.indexOf(marker);
  const end = sql.indexOf("on conflict (portfolio_id, ticker) do nothing;", start);
  assert.ok(start >= 0 && end > start, `blocul real ${code} lipseste din seed`);
  const block = sql.slice(start, end);
  const rows = [];
  const tickerTuple = /^\s*\(\d+\s*,\s*'((?:''|[^'])+)'\s*,/gm;
  let match;
  while ((match = tickerTuple.exec(block))) rows.push({ portfolioCode: code, ticker: match[1].replace(/''/g, "'") });
  return rows;
}

const mappings = parseMappings(mappingSql);
const positions = [...parsePositionTickers(positionsSql, 'US'), ...parsePositionTickers(positionsSql, 'EU')];
const key = (row) => `${row.portfolioCode}/${row.ticker}`;

test('parserul citeste seed-urile SQL reale: 20 pozitii si 20 mappings', () => {
  assert.equal(positions.length, 20);
  assert.equal(mappings.length, 20);
});

test('fiecare pozitie din seed-ul SQL real are exact un mapping in seed-ul SQL real', () => {
  const positionKeys = positions.map(key).sort();
  const mappingKeys = mappings.map(key).sort();
  assert.deepEqual(mappingKeys, positionKeys);
  assert.equal(new Set(mappingKeys).size, mappingKeys.length, 'mapping duplicat');
});

test('ticker-ele speciale si mappingurile lor sunt parsate din SQL, nu fixture hardcodat', () => {
  const rr = mappings.find((row) => key(row) === 'US/RR.');
  const inve = mappings.find((row) => key(row) === 'EU/INVE B');
  assert.equal(rr?.providerSymbol, 'RR.LSE');
  assert.equal(inve?.providerSymbol, 'INVE-B.ST');
});

test('doar VUKE si RR. au multiplier 0.01 in seed-ul real', () => {
  assert.deepEqual(mappings.filter((row) => row.multiplier !== 1).map(key).sort(), ['US/RR.', 'US/VUKE']);
});

test('simbolurile duplicate au acelasi multiplier; AAPL este deduplicabil US/EU', () => {
  const bySymbol = new Map();
  for (const row of mappings) {
    if (bySymbol.has(row.providerSymbol)) assert.equal(bySymbol.get(row.providerSymbol), row.multiplier);
    bySymbol.set(row.providerSymbol, row.multiplier);
  }
  assert.equal(mappings.filter((row) => row.providerSymbol === 'AAPL.US').length, 2);
  assert.equal(bySymbol.size, 19);
});
