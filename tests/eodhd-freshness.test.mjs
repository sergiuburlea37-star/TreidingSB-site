// tests/eodhd-freshness.test.mjs
//
// Teste pure pentru classifyQuoteFreshness (api/_lib/eodhd.js) - decide daca
// o cotatie EODHD e 'fresh' / 'stale' / 'future' / 'missing'. Aceasta decizie
// alimenteaza direct clasificarea "partial" din api/cron/sync-portfolio-prices.js
// (cerinta 3): orice status != 'fresh' forteaza runul intreg sa nu publice
// niciun snapshot.
//
// Rulare: node --test tests/
// Fara retea, fara Supabase - functie pura, `now` injectabil.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuoteFreshness, isWeeklyFinalWindow, STALE_THRESHOLD_MS } from '../api/_lib/eodhd.js';

const NOW = new Date('2026-08-14T12:00:00Z');

describe('classifyQuoteFreshness', () => {
  test('lipsa timestamp -> missing', () => {
    assert.equal(classifyQuoteFreshness(null, NOW), 'missing');
    assert.equal(classifyQuoteFreshness(undefined, NOW), 'missing');
    assert.equal(classifyQuoteFreshness('', NOW), 'missing');
  });

  test('timestamp nevalid (nu poate fi parsat) -> missing', () => {
    assert.equal(classifyQuoteFreshness('not-a-date', NOW), 'missing');
  });

  test('timestamp recent (in interiorul pragului stale) -> fresh', () => {
    const ts = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(); // acum 5 min
    assert.equal(classifyQuoteFreshness(ts, NOW), 'fresh');
  });

  test('timestamp exact la limita STALE_THRESHOLD_MS (1 ora) - inca fresh', () => {
    const ts = new Date(NOW.getTime() - STALE_THRESHOLD_MS).toISOString();
    assert.equal(classifyQuoteFreshness(ts, NOW), 'fresh');
  });

  test('timestamp cu 1 minut peste STALE_THRESHOLD_MS -> stale', () => {
    const ts = new Date(NOW.getTime() - STALE_THRESHOLD_MS - 60 * 1000).toISOString();
    assert.equal(classifyQuoteFreshness(ts, NOW), 'stale');
  });

  test('timestamp mult in trecut (ex. cateva zile) -> stale', () => {
    const ts = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(classifyQuoteFreshness(ts, NOW), 'stale');
  });

  test('timestamp cu putin in viitor (in toleranta de drift) -> fresh', () => {
    const ts = new Date(NOW.getTime() + 60 * 1000).toISOString(); // +1 min
    assert.equal(classifyQuoteFreshness(ts, NOW), 'fresh');
  });

  test('timestamp cu mult in viitor (peste toleranta de drift) -> future', () => {
    const ts = new Date(NOW.getTime() + 10 * 60 * 1000).toISOString(); // +10 min
    assert.equal(classifyQuoteFreshness(ts, NOW), 'future');
  });
});

describe('Friday weekly final pe sesiuni', () => {
  const SAFE_FRIDAY = new Date('2026-08-14T22:30:00Z');

  test('fereastra weekly final incepe abia vineri la 22:30 UTC', () => {
    assert.equal(isWeeklyFinalWindow(new Date('2026-08-14T22:29:59Z')), false);
    assert.equal(isWeeklyFinalWindow(SAFE_FRIDAY), true);
    assert.equal(isWeeklyFinalWindow(new Date('2026-08-13T22:30:00Z')), false);
  });

  test('Friday EU close + US close sunt acceptate impreuna dupa ora sigura', () => {
    assert.equal(classifyQuoteFreshness('2026-08-14T15:30:00Z', SAFE_FRIDAY, {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: true
    }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T20:00:00Z', SAFE_FRIDAY, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'fresh');
  });

  test('aceleasi date EU raman fail-closed intraday', () => {
    assert.equal(classifyQuoteFreshness('2026-08-14T15:30:00Z', new Date('2026-08-14T19:00:00Z'), {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: false
    }), 'stale');
  });

  test('un close din ziua precedenta nu este acceptat drept final de vineri', () => {
    assert.equal(classifyQuoteFreshness('2026-08-13T15:30:00Z', SAFE_FRIDAY, {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: true
    }), 'stale');
  });

  test('close minus aproape doua ore este respins pentru US, LSE si FX', () => {
    assert.equal(classifyQuoteFreshness('2026-08-14T18:01:00Z', SAFE_FRIDAY, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'stale');
    assert.equal(classifyQuoteFreshness('2026-08-14T13:31:00Z', SAFE_FRIDAY, {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: true
    }), 'stale');
    assert.equal(classifyQuoteFreshness('2026-08-14T20:01:00Z', SAFE_FRIDAY, {
      providerSymbol: 'USDGBP.FOREX', allowOfficialClose: true
    }), 'stale');
  });

  test('ultimul trade in cele 20 minute inainte de close este acceptat', () => {
    assert.equal(classifyQuoteFreshness('2026-08-14T19:40:00Z', SAFE_FRIDAY, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:39:59Z', SAFE_FRIDAY, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'stale');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:45:00Z', SAFE_FRIDAY, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T15:15:00Z', SAFE_FRIDAY, {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: true
    }), 'fresh');
    // 17:00 New York = 21:00 UTC in august.
    assert.equal(classifyQuoteFreshness('2026-08-14T20:45:00Z', SAFE_FRIDAY, {
      providerSymbol: 'USDGBP.FOREX', allowOfficialClose: true
    }), 'fresh');
  });

  test('Forex urmareste DST New York: 21:00Z vara, 22:00Z iarna', () => {
    const winterRun = new Date('2026-01-16T22:30:00Z');
    const winterCase = (timestamp) => classifyQuoteFreshness(timestamp, winterRun, {
      providerSymbol: 'EURGBP.FOREX', allowOfficialClose: true
    });
    assert.equal(winterCase('2026-01-16T21:39:59Z'), 'stale');
    assert.equal(winterCase('2026-01-16T21:40:00Z'), 'fresh');
    assert.equal(winterCase('2026-01-16T21:45:00Z'), 'fresh');
    assert.equal(winterCase('2026-01-16T22:02:00Z'), 'fresh');
    assert.equal(winterCase('2026-01-16T22:02:01Z'), 'stale');
    assert.equal(winterCase('2026-01-16T22:20:00Z'), 'stale');

    const summerCase = (timestamp) => classifyQuoteFreshness(timestamp, SAFE_FRIDAY, {
      providerSymbol: 'EURGBP.FOREX', allowOfficialClose: true
    });
    assert.equal(summerCase('2026-08-14T20:39:59Z'), 'stale');
    assert.equal(summerCase('2026-08-14T20:40:00Z'), 'fresh');
    assert.equal(summerCase('2026-08-14T21:02:00Z'), 'fresh');
    assert.equal(summerCase('2026-08-14T21:02:01Z'), 'stale');
  });

  test('saptamana cu decalaj DST US/Europa foloseste close-ul fiecarei piete', () => {
    const now = new Date('2026-03-20T22:30:00Z');
    assert.equal(classifyQuoteFreshness('2026-03-20T20:00:00Z', now, {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-03-20T16:30:00Z', now, {
      providerSymbol: 'IWDA.LSE', allowOfficialClose: true
    }), 'fresh');
  });

  test('Nasdaq Copenhagen .CO foloseste 17:00 Europe/Copenhagen si nu diverge intraday/weekly', () => {
    const summerCase = (timestamp) => classifyQuoteFreshness(timestamp, SAFE_FRIDAY, {
      providerSymbol: 'NOVO-B.CO', allowOfficialClose: true
    });
    // 17:00 CEST = 15:00Z in august.
    assert.equal(summerCase('2026-08-14T14:39:59Z'), 'stale');
    assert.equal(summerCase('2026-08-14T14:40:00Z'), 'fresh');
    assert.equal(summerCase('2026-08-14T14:45:00Z'), 'fresh');
    assert.equal(summerCase('2026-08-14T15:02:00Z'), 'fresh');
    assert.equal(summerCase('2026-08-14T15:02:01Z'), 'stale');

    // Intraday ramane pragul generic de o ora, fara a cere close-ul sesiunii.
    assert.equal(classifyQuoteFreshness('2026-08-14T14:30:00Z', new Date('2026-08-14T15:00:00Z'), {
      providerSymbol: 'NOVO-B.CO', allowOfficialClose: false
    }), 'fresh');
    // Un close din joi nu poate deveni weekly-final vineri.
    assert.equal(summerCase('2026-08-13T15:00:00Z'), 'stale');

    // 17:00 CET = 16:00Z iarna.
    assert.equal(classifyQuoteFreshness('2026-01-16T15:40:00Z', new Date('2026-01-16T22:30:00Z'), {
      providerSymbol: 'NOVO-B.CO', allowOfficialClose: true
    }), 'fresh');
  });

  test('early-close si holiday raman fail-closed fara calendar explicit', () => {
    assert.equal(classifyQuoteFreshness('2026-11-27T18:00:00Z', new Date('2026-11-27T22:30:00Z'), {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'stale');
    assert.equal(classifyQuoteFreshness('2026-12-24T21:00:00Z', new Date('2026-12-25T22:30:00Z'), {
      providerSymbol: 'AAPL.US', allowOfficialClose: true
    }), 'stale');
  });
});
