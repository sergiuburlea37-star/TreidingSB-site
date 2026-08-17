// tests/eodhd-freshness.test.mjs
//
// Teste pure pentru classifyQuoteFreshness (api/_lib/eodhd.js) - decide daca
// o cotatie EODHD e 'fresh' / 'stale' / 'future' / 'missing'. Aceasta decizie
// alimenteaza direct clasificarea "partial" din api/cron/sync-portfolio-prices.js
// (cerinta 3): orice status != 'fresh' forteaza runul intreg sa nu publice
// niciun snapshot.
//
// Piata deschisa -> pragul orar plat STALE_THRESHOLD_MS (1h) ramane semnalul
// de sincronizare esuata. Piata inchisa (weekend, pre-open, post-close) ->
// se compara fata de lastCompletedSessionClose (close-ul ultimei sesiuni
// COMPLETE, calculat explicit, nu dedus dintr-un steag extern), cu
// tolerantele deja existente. Vezi api/_lib/eodhd.js pt. detalii.
//
// Rulare: node --test tests/
// Fara retea, fara Supabase - functie pura, `now` injectabil.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuoteFreshness,
  isWeeklyFinalWindow,
  isMarketOpenNow,
  lastCompletedSessionClose,
  STALE_THRESHOLD_MS
} from '../api/_lib/eodhd.js';

const NOW = new Date('2026-08-14T12:00:00Z');

describe('classifyQuoteFreshness - fara sesiune cunoscuta (fallback prag orar plat)', () => {
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

describe('isMarketOpenNow / lastCompletedSessionClose - functii de baza', () => {
  test('AAPL.US: deschisa in timpul sesiunii, inchisa in afara', () => {
    // 2026-08-14 = vineri, vara (EDT, UTC-4): sesiune 13:30Z-20:00Z.
    assert.equal(isMarketOpenNow(new Date('2026-08-14T15:00:00Z'), { timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 }), true);
    assert.equal(isMarketOpenNow(new Date('2026-08-14T21:00:00Z'), { timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 }), false);
  });

  test('weekend -> intotdeauna inchisa, indiferent de ora', () => {
    const session = { timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 };
    assert.equal(isMarketOpenNow(new Date('2026-08-15T15:00:00Z'), session), false); // sambata
    assert.equal(isMarketOpenNow(new Date('2026-08-16T15:00:00Z'), session), false); // duminica
  });

  test('lastCompletedSessionClose: weekend -> vineri; luni pre-open -> vineri; alta zi pre-open -> ziua precedenta', () => {
    const session = { timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 };
    const fridayCloseUtc = new Date('2026-08-14T20:00:00Z').getTime();
    assert.equal(lastCompletedSessionClose(new Date('2026-08-15T12:00:00Z'), session), fridayCloseUtc); // sambata
    assert.equal(lastCompletedSessionClose(new Date('2026-08-16T12:00:00Z'), session), fridayCloseUtc); // duminica
    assert.equal(lastCompletedSessionClose(new Date('2026-08-17T08:00:00Z'), session), fridayCloseUtc); // luni pre-open (08:00 EDT < 09:30)
    // marti pre-open -> luni (18-a)
    const mondayCloseUtc = new Date('2026-08-17T20:00:00Z').getTime();
    assert.equal(lastCompletedSessionClose(new Date('2026-08-18T08:00:00Z'), session), mondayCloseUtc);
  });
});

describe('sesiune deschisa -> pragul orar plat (US si UK/LSE)', () => {
  test('AAPL.US, vineri in timpul pietei: prag orar plat', () => {
    const now = new Date('2026-08-14T15:00:00Z'); // 11:00 EDT, piata deschisa (9:30-16:00)
    assert.equal(isMarketOpenNow(now, { timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 }), true);
    assert.equal(classifyQuoteFreshness('2026-08-14T14:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh'); // 5 min
    assert.equal(classifyQuoteFreshness('2026-08-14T13:30:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // 90 min
  });

  test('IWDA.LSE, vineri in timpul pietei: prag orar plat', () => {
    const now = new Date('2026-08-14T10:00:00Z'); // 11:00 BST, piata deschisa (8:00-16:30)
    assert.equal(classifyQuoteFreshness('2026-08-14T09:55:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh'); // 5 min
    assert.equal(classifyQuoteFreshness('2026-08-14T08:30:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'stale'); // 90 min
  });

  test('AAPL.US, luni in timpul pietei: prag orar plat (nu doar vineri)', () => {
    const now = new Date('2026-08-17T15:00:00Z'); // 11:00 EDT, luni
    assert.equal(classifyQuoteFreshness('2026-08-17T14:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-17T13:30:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale');
  });
});

describe('sesiune inchisa -> comparatie fata de lastCompletedSessionClose', () => {
  test('AAPL.US, vineri dupa close: close-ul zilei curente', () => {
    const now = new Date('2026-08-14T21:00:00Z'); // 17:00 EDT, dupa close (16:00)
    assert.equal(classifyQuoteFreshness('2026-08-14T19:45:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh'); // close-15min
    assert.equal(classifyQuoteFreshness('2026-08-14T19:00:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // close-1h
  });

  test('IWDA.LSE, vineri dupa close: close-ul zilei curente', () => {
    const now = new Date('2026-08-14T17:00:00Z'); // 18:00 BST, dupa close (16:30)
    assert.equal(classifyQuoteFreshness('2026-08-14T15:20:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T14:00:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'stale');
  });

  test('AAPL.US, sambata: close-ul de vineri', () => {
    const now = new Date('2026-08-15T12:00:00Z');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:50:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T18:00:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale');
  });

  test('IWDA.LSE, sambata: close-ul de vineri', () => {
    const now = new Date('2026-08-15T12:00:00Z');
    assert.equal(classifyQuoteFreshness('2026-08-14T15:20:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T13:00:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'stale');
  });

  test('AAPL.US, duminica: close-ul de vineri', () => {
    const now = new Date('2026-08-16T12:00:00Z');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-13T19:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // joi
  });

  test('AAPL.US, luni pre-open: close-ul de vineri (nu al lui luni)', () => {
    const now = new Date('2026-08-17T12:00:00Z'); // 08:00 EDT, inainte de 09:30
    assert.equal(classifyQuoteFreshness('2026-08-14T19:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-13T19:55:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // joi
  });

  test('AAPL.US, luni dupa close: close-ul zilei curente (luni), nu al lui vineri', () => {
    const now = new Date('2026-08-17T21:00:00Z'); // 17:00 EDT, dupa close
    assert.equal(classifyQuoteFreshness('2026-08-17T19:50:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:50:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // vineri, prea vechi
  });
});

describe('MAX_CLOSING_PRINT_DELAY_MS - toleranta separata pt. printul de inchidere (nu FUTURE_SKEW_TOLERANCE_MS)', () => {
  // Caz real #1 (2026-08-16, test Preview): AAPL.US, close nominal 20:00Z,
  // EODHD a raportat timestamp 20:28Z (+28 min) - respins gresit inainte de
  // prima schimbare (FUTURE_SKEW_TOLERANCE_MS de 2 min folosit gresit ca
  // limita fata de close).
  //
  // Caz real #2 (2026-08-16, test Preview): IWDA.LSE, close nominal 15:30Z,
  // EODHD a raportat timestamp 17:05Z (+95 min) - respins gresit de prima
  // toleranta dedicata (1 ora), care a fost extinsa la 2 ore in urma acestui
  // al doilea caz real.
  test('AAPL.US: close+28min (cazul real #1) si close+119min fresh, close+121min stale', () => {
    const now = new Date('2026-08-15T00:00:00Z'); // 20:00 EDT, mult dupa close (16:00 EDT = 20:00Z)
    assert.equal(classifyQuoteFreshness('2026-08-14T20:28:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh'); // close+28min
    assert.equal(classifyQuoteFreshness('2026-08-14T21:59:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh'); // close+119min
    assert.equal(classifyQuoteFreshness('2026-08-14T22:01:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // close+121min
  });

  test('AAPL.US: close-20min fresh (neschimbat), close-21min stale', () => {
    const now = new Date('2026-08-15T00:00:00Z');
    assert.equal(classifyQuoteFreshness('2026-08-14T19:40:00Z', now, { providerSymbol: 'AAPL.US' }), 'fresh'); // close-20min
    assert.equal(classifyQuoteFreshness('2026-08-14T19:39:00Z', now, { providerSymbol: 'AAPL.US' }), 'stale'); // close-21min
  });

  test('IWDA.LSE (bursa europeana): close+95min (cazul real #2) si close+119min fresh, close+121min stale', () => {
    const now = new Date('2026-08-14T20:00:00Z'); // 21:00 BST, mult dupa close (16:30 BST = 15:30Z)
    assert.equal(classifyQuoteFreshness('2026-08-14T17:05:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh'); // close+95min
    assert.equal(classifyQuoteFreshness('2026-08-14T17:29:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh'); // close+119min
    assert.equal(classifyQuoteFreshness('2026-08-14T17:31:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'stale'); // close+121min
  });

  test('IWDA.LSE: close-20min fresh (neschimbat), close-21min stale', () => {
    const now = new Date('2026-08-14T20:00:00Z');
    assert.equal(classifyQuoteFreshness('2026-08-14T15:10:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'fresh'); // close-20min
    assert.equal(classifyQuoteFreshness('2026-08-14T15:09:00Z', now, { providerSymbol: 'IWDA.LSE' }), 'stale'); // close-21min
  });

  test('un timestamp viitor fata de `now` tot devine "future", nu "fresh"/"stale" fata de close', () => {
    const now = new Date('2026-08-15T00:00:00Z');
    // close+121min (22:01Z) ar fi stale fata de close, dar aici testam strict
    // fata de `now`: +10 min peste now e peste FUTURE_SKEW_TOLERANCE_MS.
    assert.equal(classifyQuoteFreshness('2026-08-15T00:10:00Z', now, { providerSymbol: 'AAPL.US' }), 'future');
  });
});

describe('validarea future ramane neschimbata, chiar cu piata inchisa', () => {
  test('un timestamp viitor e respins ca "future" inainte de orice comparatie de sesiune', () => {
    const now = new Date('2026-08-14T21:00:00Z'); // vineri, dupa close
    // close+toleranta ar fi 20:02Z; testam un timestamp explicit dupa now+toleranta (21:02Z).
    assert.equal(classifyQuoteFreshness('2026-08-14T21:05:00Z', now, { providerSymbol: 'AAPL.US' }), 'future');
  });
});

describe('DST: US si doua burse europene, iarna vs. vara', () => {
  test('AAPL.US dupa close - iarna (EST, UTC-5) vs. vara (EDT, UTC-4)', () => {
    const winterNow = new Date('2026-01-16T22:00:00Z'); // 17:00 EST, dupa close (16:00 EST = 21:00Z)
    assert.equal(classifyQuoteFreshness('2026-01-16T20:50:00Z', winterNow, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-01-16T19:00:00Z', winterNow, { providerSymbol: 'AAPL.US' }), 'stale');

    const summerNow = new Date('2026-08-14T21:00:00Z'); // 17:00 EDT, dupa close (16:00 EDT = 20:00Z)
    assert.equal(classifyQuoteFreshness('2026-08-14T19:50:00Z', summerNow, { providerSymbol: 'AAPL.US' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T18:00:00Z', summerNow, { providerSymbol: 'AAPL.US' }), 'stale');
  });

  test('IWDA.LSE dupa close - iarna (GMT, UTC+0) vs. vara (BST, UTC+1)', () => {
    const winterNow = new Date('2026-01-16T18:00:00Z'); // 18:00 GMT, dupa close (16:30 GMT = 16:30Z)
    assert.equal(classifyQuoteFreshness('2026-01-16T16:20:00Z', winterNow, { providerSymbol: 'IWDA.LSE' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-01-16T15:00:00Z', winterNow, { providerSymbol: 'IWDA.LSE' }), 'stale');

    const summerNow = new Date('2026-08-14T17:00:00Z'); // 18:00 BST, dupa close (16:30 BST = 15:30Z)
    assert.equal(classifyQuoteFreshness('2026-08-14T15:20:00Z', summerNow, { providerSymbol: 'IWDA.LSE' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T14:00:00Z', summerNow, { providerSymbol: 'IWDA.LSE' }), 'stale');
  });

  test('NOVO-B.CO dupa close - iarna (CET, UTC+1) vs. vara (CEST, UTC+2)', () => {
    const winterNow = new Date('2026-01-16T18:00:00Z'); // 19:00 CET, dupa close (17:00 CET = 16:00Z)
    assert.equal(classifyQuoteFreshness('2026-01-16T15:50:00Z', winterNow, { providerSymbol: 'NOVO-B.CO' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-01-16T14:00:00Z', winterNow, { providerSymbol: 'NOVO-B.CO' }), 'stale');

    const summerNow = new Date('2026-08-14T17:00:00Z'); // 19:00 CEST, dupa close (17:00 CEST = 15:00Z)
    assert.equal(classifyQuoteFreshness('2026-08-14T14:50:00Z', summerNow, { providerSymbol: 'NOVO-B.CO' }), 'fresh');
    assert.equal(classifyQuoteFreshness('2026-08-14T13:00:00Z', summerNow, { providerSymbol: 'NOVO-B.CO' }), 'stale');
  });
});

describe('isWeeklyFinalWindow - ramas neschimbat, folosit doar pt. snapshot_kind', () => {
  test('fereastra weekly final incepe abia vineri la 22:30 UTC', () => {
    assert.equal(isWeeklyFinalWindow(new Date('2026-08-14T22:29:59Z')), false);
    assert.equal(isWeeklyFinalWindow(new Date('2026-08-14T22:30:00Z')), true);
    assert.equal(isWeeklyFinalWindow(new Date('2026-08-13T22:30:00Z')), false);
  });
});

describe('early-close si holiday raman fail-closed fara calendar explicit', () => {
  test('sarbatoare (Thanksgiving/Craciun): quote-ul nu se potriveste cu programul presupus -> stale', () => {
    assert.equal(classifyQuoteFreshness('2026-11-27T18:00:00Z', new Date('2026-11-27T22:30:00Z'), {
      providerSymbol: 'AAPL.US'
    }), 'stale');
    assert.equal(classifyQuoteFreshness('2026-12-24T21:00:00Z', new Date('2026-12-25T22:30:00Z'), {
      providerSymbol: 'AAPL.US'
    }), 'stale');
  });
});
