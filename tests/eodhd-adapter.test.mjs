// tests/eodhd-adapter.test.mjs
//
// Teste pure pentru api/_lib/eodhd.js, cu `fetchImpl` injectat (niciun apel
// de retea real). Acopera forma URL-ului, normalizarea raspunsului, cazurile
// de eroare (HTTP non-ok, JSON malformat, token lipsa) si garantia ca un
// mesaj de eroare normalizat nu contine niciodata tokenul/URL-ul brut
// (EODHD_API_TOKEN nu trebuie sa ajunga in loguri - vezi header-ul
// api/_lib/eodhd.js).
//
// Rulare: node --test tests/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLiveDelayedPrices, fetchLiveDelayedFxRates } from '../api/_lib/eodhd.js';

function fakeFetch(handler) {
  return async (url, opts) => handler(url, opts);
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe('fetchLiveDelayedPrices', () => {
  test('arunca eroare clara daca tokenul lipseste', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], { token: '', fetchImpl: fakeFetch(() => jsonResponse([])) }),
      /EODHD_API_TOKEN/
    );
  });

  test('lista goala de simboluri -> [] fara niciun apel HTTP', async () => {
    let called = false;
    const result = await fetchLiveDelayedPrices([], {
      token: 'tok',
      fetchImpl: fakeFetch(() => { called = true; return jsonResponse([]); })
    });
    assert.deepEqual(result, []);
    assert.equal(called, false);
  });

  test('URL: primul simbol in path, restul via &s=, tokenul ca query param', async () => {
    let capturedUrl = null;
    await fetchLiveDelayedPrices(['IWDA.LSE', 'AAPL.US', 'RR.LSE'], {
      token: 'secret-token',
      fetchImpl: fakeFetch((url) => { capturedUrl = url; return jsonResponse([]); })
    });
    assert.match(capturedUrl, /^https:\/\/eodhd\.com\/api\/real-time\/IWDA\.LSE\?/);
    assert.match(capturedUrl, /api_token=secret-token/);
    assert.match(capturedUrl, /s=AAPL\.US,RR\.LSE/);
  });

  test('normalizeaza code/close/timestamp -> providerSymbol/price/providerTimestamp', async () => {
    const result = await fetchLiveDelayedPrices(['AAPL.US'], {
      token: 'tok',
      fetchImpl: fakeFetch(() => jsonResponse([
        { code: ' AAPL.US ', close: 291.42, timestamp: 1755172800 } // 2025-08-14T12:00:00Z
      ]))
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].providerSymbol, 'AAPL.US');
    assert.equal(result[0].price, 291.42);
    assert.equal(result[0].providerTimestamp, new Date(1755172800 * 1000).toISOString());
  });

  test('raspuns obiect unic (nu array) e tratat ca o singura cotatie', async () => {
    const result = await fetchLiveDelayedPrices(['AAPL.US'], {
      token: 'tok',
      fetchImpl: fakeFetch(() => jsonResponse({ code: 'AAPL.US', close: 100, timestamp: 1755172800 }))
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].providerSymbol, 'AAPL.US');
  });

  test('rand fara code e ignorat (filtrat, nu arunca)', async () => {
    const result = await fetchLiveDelayedPrices(['AAPL.US'], {
      token: 'tok',
      fetchImpl: fakeFetch(() => jsonResponse([{ close: 100, timestamp: 1755172800 }]))
    });
    assert.deepEqual(result, []);
  });

  test('close/timestamp lipsa sau nevalide -> price/providerTimestamp null (nu 0/NaN)', async () => {
    const result = await fetchLiveDelayedPrices(['AAPL.US'], {
      token: 'tok',
      fetchImpl: fakeFetch(() => jsonResponse([{ code: 'AAPL.US', close: null, timestamp: 'nope' }]))
    });
    assert.equal(result[0].price, null);
    assert.equal(result[0].providerTimestamp, null);
  });

  test('close 0, negativ, NaN sau overflow -> price null', async () => {
    const values = [0, -1, 'NaN', '1e9999'];
    for (const close of values) {
      const result = await fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'tok',
        fetchImpl: fakeFetch(() => jsonResponse([{ code: 'AAPL.US', close, timestamp: 1755172800 }]))
      });
      assert.equal(result[0].price, null, `close invalid acceptat: ${close}`);
    }
  });

  test('status HTTP non-ok -> arunca eroare cu statusul, fara sa expuna URL-ul', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'secret-token',
        fetchImpl: fakeFetch(() => jsonResponse(null, { ok: false, status: 503 }))
      }),
      (err) => {
        assert.match(err.message, /503/);
        assert.doesNotMatch(err.message, /secret-token/);
        return true;
      }
    );
  });

  test('JSON malformat -> eroare clara, nu propaga exceptia bruta de parsare', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'tok',
        fetchImpl: fakeFetch(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }))
      }),
      /malformed JSON/
    );
  });

  test('eroare de retea/abort a fetch-ului -> mesaj normalizat, nu obiectul brut (poate contine tokenul in URL)', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'secret-token',
        fetchImpl: fakeFetch(() => { throw new Error('AbortError: fetch https://eodhd.com/...?api_token=secret-token'); })
      }),
      (err) => {
        assert.match(err.message, /timed out|failed/);
        assert.doesNotMatch(err.message, /secret-token/);
        return true;
      }
    );
  });
});

describe('fetchLiveDelayedFxRates', () => {
  test('lista goala -> [] fara apel HTTP', async () => {
    let called = false;
    const result = await fetchLiveDelayedFxRates([], {
      token: 'tok',
      fetchImpl: fakeFetch(() => { called = true; return jsonResponse([]); })
    });
    assert.deepEqual(result, []);
    assert.equal(called, false);
  });

  test('construieste simboluri BASEQUOTE.FOREX si remapeaza inapoi la {baseCurrency, quoteCurrency}', async () => {
    let capturedUrl = null;
    const result = await fetchLiveDelayedFxRates([{ base: 'USD', quote: 'GBP' }], {
      token: 'tok',
      fetchImpl: fakeFetch((url) => {
        capturedUrl = url;
        return jsonResponse([{ code: 'USDGBP.FOREX', close: 0.79, timestamp: 1755172800 }]);
      })
    });
    assert.match(capturedUrl, /\/USDGBP\.FOREX\?/);
    assert.equal(result.length, 1);
    assert.equal(result[0].baseCurrency, 'USD');
    assert.equal(result[0].quoteCurrency, 'GBP');
    assert.equal(result[0].rate, 0.79);
  });

  test('cotatie EODHD fara pereche corespunzatoare in cerere e ignorata', async () => {
    const result = await fetchLiveDelayedFxRates([{ base: 'USD', quote: 'GBP' }], {
      token: 'tok',
      fetchImpl: fakeFetch(() => jsonResponse([{ code: 'EURUSD.FOREX', close: 1.1, timestamp: 1755172800 }]))
    });
    assert.deepEqual(result, []);
  });

  test('FX 0 sau negativ este normalizat la null, nu publicat ca rata', async () => {
    for (const close of [0, -0.5]) {
      const result = await fetchLiveDelayedFxRates([{ base: 'USD', quote: 'GBP' }], {
        token: 'tok',
        fetchImpl: fakeFetch(() => jsonResponse([{ code: 'USDGBP.FOREX', close, timestamp: 1755172800 }]))
      });
      assert.equal(result[0].rate, null);
    }
  });
});
