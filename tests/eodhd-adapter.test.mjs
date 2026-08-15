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
import { fetchLiveDelayedPrices, fetchLiveDelayedFxRates, EODHD_FETCH_ERROR_CATEGORIES } from '../api/_lib/eodhd.js';

function fakeFetch(handler) {
  return async (url, opts) => handler(url, opts);
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe('fetchLiveDelayedPrices', () => {
  test('arunca eroare categorisita daca tokenul lipseste, fara sa expuna vreun detaliu', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], { token: '', fetchImpl: fakeFetch(() => jsonResponse([])) }),
      (err) => {
        assert.equal(err.category, 'eodhd_token_missing');
        return true;
      }
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

  test('status HTTP non-ok necunoscut (503) -> eodhd_http_other, fara sa expuna URL-ul/tokenul', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'secret-token',
        fetchImpl: fakeFetch(() => jsonResponse(null, { ok: false, status: 503 }))
      }),
      (err) => {
        assert.equal(err.category, 'eodhd_http_other');
        assert.doesNotMatch(err.message, /secret-token/);
        assert.doesNotMatch(err.message, /503/); // statusul brut nu trebuie sa apara in mesaj, doar categoria
        return true;
      }
    );
  });

  test('status HTTP 401/403/429 -> categorii distincte, dedicate', async () => {
    const cases = [[401, 'eodhd_http_401'], [403, 'eodhd_http_403'], [429, 'eodhd_http_429']];
    for (const [status, expectedCategory] of cases) {
      await assert.rejects(
        () => fetchLiveDelayedPrices(['AAPL.US'], {
          token: 'secret-token',
          fetchImpl: fakeFetch(() => jsonResponse(null, { ok: false, status }))
        }),
        (err) => {
          assert.equal(err.category, expectedCategory, `status ${status}`);
          assert.doesNotMatch(err.message, /secret-token/);
          return true;
        }
      );
    }
  });

  test('JSON malformat -> eodhd_invalid_json, nu propaga exceptia bruta de parsare', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'tok',
        fetchImpl: fakeFetch(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }))
      }),
      (err) => {
        assert.equal(err.category, 'eodhd_invalid_json');
        return true;
      }
    );
  });

  test('abort real (AbortError) -> eodhd_timeout, nu obiectul brut (poate contine tokenul in URL)', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'secret-token',
        fetchImpl: fakeFetch(() => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          throw err;
        })
      }),
      (err) => {
        assert.equal(err.category, 'eodhd_timeout');
        assert.doesNotMatch(err.message, /secret-token/);
        return true;
      }
    );
  });

  test('eroare de retea generica (non-abort) -> eodhd_network_error, nu obiectul brut', async () => {
    await assert.rejects(
      () => fetchLiveDelayedPrices(['AAPL.US'], {
        token: 'secret-token',
        fetchImpl: fakeFetch(() => { throw new Error('fetch failed: getaddrinfo ENOTFOUND eodhd.com?api_token=secret-token'); })
      }),
      (err) => {
        assert.equal(err.category, 'eodhd_network_error');
        assert.doesNotMatch(err.message, /secret-token/);
        return true;
      }
    );
  });

  test('eroare aruncata inainte de orice fetch (input nevalid) -> plasa de siguranta o categorizeaza generic', async () => {
    // symbols nevalid (nu array) rupe dedupeProviderSymbols() inainte de a
    // ajunge la vreun bloc try/catch categorizat - exact scenariul pe care
    // wrapper-ul de siguranta din fetchQuotes() trebuie sa-l prinda.
    await assert.rejects(
      () => fetchLiveDelayedPrices(/** @type {any} */ (123), { token: 'tok', fetchImpl: fakeFetch(() => jsonResponse([])) }),
      (err) => {
        assert.equal(err.category, 'eodhd_unknown_fetch_error');
        return true;
      }
    );
  });
});

describe('EODHD_FETCH_ERROR_CATEGORIES', () => {
  test('lista de categorii sanitizate e completa si stabila', () => {
    assert.deepEqual([...EODHD_FETCH_ERROR_CATEGORIES].sort(), [
      'eodhd_http_401',
      'eodhd_http_403',
      'eodhd_http_429',
      'eodhd_http_other',
      'eodhd_invalid_json',
      'eodhd_network_error',
      'eodhd_timeout',
      'eodhd_token_missing',
      'eodhd_unknown_fetch_error'
    ].sort());
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
