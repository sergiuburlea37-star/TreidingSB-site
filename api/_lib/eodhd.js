// api/_lib/eodhd.js
//
// Adaptor server-side peste EODHD "Live Delayed" REST (intarziere 15-20 min
// fata de piata reala pe abonamentele non-realtime - NU trebuie prezentat
// NICIODATA ca "real-time" in UI/comentarii/loguri, desi asta e denumirea
// proprie a path-ului EODHD, folosita mai jos doar pentru ca vine din API-ul
// extern, nu din alegerea noastra de terminologie).
//
// Fara dependinte Supabase - functii pure, testabile izolat (fetchImpl
// injectabil), ca api/_lib/fx-convert.js. EODHD_API_TOKEN nu trebuie sa
// ajunga NICIODATA intr-un raspuns HTTP, un log sau frontend - de aceea
// erorile de retea sunt normalizate la un mesaj generic (fetch-ul brut sau
// URL-ul cererii pot contine tokenul ca query param).

const EODHD_BASE = 'https://eodhd.com/api/real-time';
const FETCH_TIMEOUT_MS = 8000;

// Categorii sanitizate pentru esecurile de fetch - niciodata mesajul brut de
// eroare (poate contine URL-ul, deci tokenul, pe unele implementari de
// fetch). Folosite in audit (portfolio_sync_runs.problems) si in raspunsul
// HTTP al endpoint-ului de sync, niciodata in loguri cu detalii brute.
//
// Categoriile non-HTTP raman o lista inchisa (5 valori fixe). Categoriile
// HTTP sunt generate dinamic ca `eodhd_http_<status>` (ex. eodhd_http_404,
// eodhd_http_500) pentru orice cod non-2xx - inclusiv 401/403/429, fara
// ramuri speciale - si validate printr-un pattern (nu o lista enumerata,
// imposibil de exhaustivat pt. toate codurile HTTP posibile), care admite
// STRICT 3 cifre in intervalul valid 1xx-5xx. Niciodata statusul brut nu
// ajunge in alta forma (fara text/reason-phrase de la server).
export const EODHD_FETCH_ERROR_FIXED_CATEGORIES = Object.freeze([
  'eodhd_token_missing',
  'eodhd_timeout',
  'eodhd_invalid_json',
  'eodhd_network_error',
  'eodhd_unknown_fetch_error'
]);

const EODHD_HTTP_CATEGORY_PATTERN = /^eodhd_http_[1-5]\d{2}$/;

export function isKnownEodhdFetchErrorCategory(category) {
  return typeof category === 'string' && (
    EODHD_FETCH_ERROR_FIXED_CATEGORIES.includes(category) ||
    EODHD_HTTP_CATEGORY_PATTERN.test(category)
  );
}

export class EodhdFetchError extends Error {
  constructor(category) {
    const safeCategory = isKnownEodhdFetchErrorCategory(category)
      ? category
      : 'eodhd_unknown_fetch_error';
    super(safeCategory);
    this.name = 'EodhdFetchError';
    this.category = safeCategory;
  }
}

// Toleranta pt. drift de ceas intre serverul nostru si EODHD - NU o licenta
// de a accepta date cu adevarat viitoare; orice depaseste asta e tratat ca
// 'future' (semnal de problema de date, echivalent cu 'missing' pt. runul
// curent - vezi api/cron/sync-portfolio-prices.js).
const FUTURE_SKEW_TOLERANCE_MS = 2 * 60 * 1000;

// Prag de "stale" confirmat explicit: 1 ora. EODHD insusi are o intarziere
// normala de 15-20 min pe acest abonament - un cotatie mai veche de o ora
// inseamna ca mai multe cicluri de sincronizare (la 15 min) nu au adus nimic
// nou pt. acel simbol, semn real de problema, nu doar intarziere normala.
export const STALE_THRESHOLD_MS = 60 * 60 * 1000;
export const WEEKLY_FINAL_SAFE_UTC_HOUR = 22;
export const WEEKLY_FINAL_SAFE_UTC_MINUTE = 30;

// Timestamp-ul EODHD este timestamp de piata, nu ora la care raspunsul
// intarziat ajunge la noi. Permitem cel mult 20 minute inainte de close ca
// toleranta pentru ultimul trade al unui instrument mai putin lichid; delay-ul
// de livrare este acoperit separat de fereastra safe 22:30 UTC.
const MAX_LAST_TRADE_BEFORE_CLOSE_MS = 20 * 60 * 1000;
const MARKET_SESSIONS = {
  US: { timeZone: 'America/New_York', closeHour: 16, closeMinute: 0 },
  LSE: { timeZone: 'Europe/London', closeHour: 16, closeMinute: 30 },
  XETRA: { timeZone: 'Europe/Berlin', closeHour: 17, closeMinute: 30 },
  AS: { timeZone: 'Europe/Amsterdam', closeHour: 17, closeMinute: 30 },
  PA: { timeZone: 'Europe/Paris', closeHour: 17, closeMinute: 30 },
  SW: { timeZone: 'Europe/Zurich', closeHour: 17, closeMinute: 30 },
  MC: { timeZone: 'Europe/Madrid', closeHour: 17, closeMinute: 30 },
  MI: { timeZone: 'Europe/Rome', closeHour: 17, closeMinute: 30 },
  BR: { timeZone: 'Europe/Brussels', closeHour: 17, closeMinute: 30 },
  ST: { timeZone: 'Europe/Stockholm', closeHour: 17, closeMinute: 30 },
  // EODHD CO = Nasdaq Copenhagen. Programul normal se inchide la 17:00
  // ora locala; Europe/Copenhagen aplica automat CET/CEST.
  CO: { timeZone: 'Europe/Copenhagen', closeHour: 17, closeMinute: 0 },
  // Saptamana FX se inchide vineri la 17:00 New York: 21:00 UTC vara,
  // 22:00 UTC iarna. America/New_York rezolva inclusiv DST si saptamanile
  // in care US si Europa schimba ora la date diferite.
  FOREX: { timeZone: 'America/New_York', closeHour: 17, closeMinute: 0 }
};

export const SUPPORTED_MARKET_SUFFIXES = Object.freeze(Object.keys(MARKET_SESSIONS));

export function normalizeProviderSymbol(providerSymbol) {
  return providerSymbol == null ? '' : String(providerSymbol).trim();
}

export function hasMarketSessionPolicy(providerSymbol) {
  const match = normalizeProviderSymbol(providerSymbol).match(/^.+\.([A-Za-z0-9]+)$/);
  return !!match && Object.hasOwn(MARKET_SESSIONS, match[1].toUpperCase());
}

export function dedupeProviderSymbols(symbols) {
  return [...new Set((symbols || []).map(normalizeProviderSymbol).filter(Boolean))];
}

async function fetchQuotes(symbols, opts = {}) {
  // Plasa de siguranta: orice eroare care ar scapa nesanitizata din
  // fetchQuotesUnsafe (schimbare viitoare de cod, dependinta noua etc.) e
  // prinsa aici si redusa la categoria generica, niciodata propagata bruta.
  try {
    return await fetchQuotesUnsafe(symbols, opts);
  } catch (err) {
    if (err instanceof EodhdFetchError) throw err;
    throw new EodhdFetchError('eodhd_unknown_fetch_error');
  }
}

// Confirmat experimental (2026-08-16): EODHD accepta bulk-quote cu cel mult
// 9 simboluri intr-un singur request (10+ -> HTTP 404). Peste aceasta
// limita, cererea trebuie impartita in batch-uri separate.
export const EODHD_MAX_SYMBOLS_PER_REQUEST = 9;

function chunkSymbols(symbols, size) {
  const chunks = [];
  for (let i = 0; i < symbols.length; i += size) {
    chunks.push(symbols.slice(i, i + size));
  }
  return chunks;
}

async function fetchQuotesUnsafe(symbols, { token = process.env.EODHD_API_TOKEN, fetchImpl = fetch } = {}) {
  if (!token) throw new EodhdFetchError('eodhd_token_missing');
  const uniqueSymbols = dedupeProviderSymbols(symbols);
  if (!uniqueSymbols.length) return [];

  const batches = chunkSymbols(uniqueSymbols, EODHD_MAX_SYMBOLS_PER_REQUEST);
  // Promise.all: daca oricare batch esueaza, intreaga cerere e respinsa
  // (fail-closed) - nu se returneaza niciodata un rezultat partial compus
  // doar din batch-urile reusite.
  const batchResults = await Promise.all(batches.map((batch) => fetchQuoteBatch(batch, { token, fetchImpl })));
  return batchResults.flat();
}

async function fetchQuoteBatch(batchSymbols, { token, fetchImpl }) {
  // EODHD real-time (bulk quote): primul simbol e param de path, restul
  // via &s=SYM1,SYM2,... (maxim EODHD_MAX_SYMBOLS_PER_REQUEST simboluri
  // per batch, impus de apelant).
  const [first, ...rest] = batchSymbols;
  const url = `${EODHD_BASE}/${encodeURIComponent(first)}?api_token=${encodeURIComponent(token)}&fmt=json` +
    (rest.length ? `&s=${rest.map(encodeURIComponent).join(',')}` : '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, { signal: controller.signal });
  } catch (err) {
    // Nu propaga err direct - poate contine URL-ul (deci tokenul) pe unele
    // implementari de fetch la abort/eroare de retea. Categorisit sanitizat,
    // fara mesajul brut.
    throw new EodhdFetchError(err && err.name === 'AbortError' ? 'eodhd_timeout' : 'eodhd_network_error');
  } finally {
    clearTimeout(timer);
  }

  // Statusul numeric intra direct in categorie (ex. eodhd_http_404,
  // eodhd_http_500) - fara text/reason-phrase de la server, doar codul.
  // EodhdFetchError valideaza oricum categoria contra pattern-ului inainte
  // s-o accepte, deci un status neasteptat (in afara 1xx-5xx) cade sigur pe
  // eodhd_unknown_fetch_error.
  if (!res.ok) throw new EodhdFetchError(`eodhd_http_${res.status}`);

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new EodhdFetchError('eodhd_invalid_json');
  }

  const rows = Array.isArray(body) ? body : [body];
  return rows.map(normalizeQuote).filter(Boolean);
}

// Campuri raspuns EODHD real-time (per simbol): code, timestamp (secunde
// unix), gmtoffset, open, high, low, close, volume, previousClose, change,
// change_p. Folosim doar code/close/timestamp.
function normalizeQuote(row) {
  if (!row || row.code == null) return null;
  const timestampSec = Number(row.timestamp);
  const price = row.close != null ? Number(row.close) : null;
  return {
    providerSymbol: normalizeProviderSymbol(row.code),
    price: Number.isFinite(price) && price > 0 ? price : null,
    providerTimestamp: Number.isFinite(timestampSec) ? new Date(timestampSec * 1000).toISOString() : null
  };
}

// symbols: array de coduri EODHD (ex. 'IWDA.LSE', 'AAPL.US'). Returneaza
// [{ providerSymbol, price, providerTimestamp }]. NU aplica multiplicatorul
// GBX/pence - asta e responsabilitatea apelantului (are nevoie de
// provider_price_multiplier per pozitie, necunoscut aici).
export async function fetchLiveDelayedPrices(symbols, opts = {}) {
  return fetchQuotes(symbols, opts);
}

// pairs: array de { base, quote } (coduri valutare ISO, ex. { base: 'USD',
// quote: 'GBP' }). Foloseste acelasi endpoint EODHD, cu simboluri de forma
// 'USDGBP.FOREX' - separata de fetchLiveDelayedPrices doar pentru
// claritate/testabilitate, mecanismul HTTP e identic.
export async function fetchLiveDelayedFxRates(pairs, opts = {}) {
  if (!pairs || !pairs.length) return [];

  const symbolToPair = new Map();
  const symbols = [];
  for (const p of pairs) {
    const symbol = `${p.base}${p.quote}.FOREX`;
    if (!symbolToPair.has(symbol)) {
      symbolToPair.set(symbol, p);
      symbols.push(symbol);
    }
  }

  const quotes = await fetchQuotes(symbols, opts);
  return quotes
    .map((q) => {
      const pair = symbolToPair.get(q.providerSymbol);
      if (!pair) return null;
      return {
        baseCurrency: pair.base,
        quoteCurrency: pair.quote,
        rate: q.price,
        providerTimestamp: q.providerTimestamp
      };
    })
    .filter(Boolean);
}

// Pura, fara retea - testabila izolat. 'missing' (fara timestamp valid),
// 'future' (peste toleranta de drift), 'stale' (mai vechi de STALE_THRESHOLD_MS),
// altfel 'fresh'. Orice status != 'fresh' forteaza runul curent sa fie
// 'partial' (vezi api/cron/sync-portfolio-prices.js).
export function isWeeklyFinalWindow(now = new Date()) {
  return now.getUTCDay() === 5 && (
    now.getUTCHours() > WEEKLY_FINAL_SAFE_UTC_HOUR ||
    (now.getUTCHours() === WEEKLY_FINAL_SAFE_UTC_HOUR && now.getUTCMinutes() >= WEEKLY_FINAL_SAFE_UTC_MINUTE)
  );
}

function getSession(providerSymbol) {
  const suffix = normalizeProviderSymbol(providerSymbol).split('.').pop().toUpperCase();
  return MARKET_SESSIONS[suffix] || null;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

function localSessionCloseUtc(localDate, session) {
  const desiredAsUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day, session.closeHour, session.closeMinute, 0);
  let guess = desiredAsUtc;
  for (let i = 0; i < 2; i++) {
    const actual = zonedParts(new Date(guess), session.timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desiredAsUtc - actualAsUtc;
  }
  return guess;
}

function officialCloseUtc(now, session) {
  const localNow = zonedParts(now, session.timeZone);
  let close = localSessionCloseUtc(localNow, session);
  // Runul weekly-final poate avea loc dupa miezul noptii locale (de ex.
  // Copenhagen vara la 22:30Z = sambata 00:30 CEST). In acel caz close-ul
  // relevant este ultima zi locala, nu close-ul viitor de sambata.
  if (close > now.getTime()) {
    const previousLocalDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day) - 24 * 60 * 60 * 1000);
    close = localSessionCloseUtc({
      year: previousLocalDate.getUTCFullYear(),
      month: previousLocalDate.getUTCMonth() + 1,
      day: previousLocalDate.getUTCDate()
    }, session);
  }
  return close;
}

export function classifyQuoteFreshness(providerTimestampIso, now = new Date(), options = {}) {
  if (!providerTimestampIso) return 'missing';
  const ts = new Date(providerTimestampIso).getTime();
  if (!Number.isFinite(ts)) return 'missing';
  if (ts > now.getTime() + FUTURE_SKEW_TOLERANCE_MS) return 'future';
  if (options.allowOfficialClose) {
    const session = getSession(options.providerSymbol);
    if (!session) return 'stale';
    const close = officialCloseUtc(now, session);
    if (now.getTime() < close || ts < close - MAX_LAST_TRADE_BEFORE_CLOSE_MS || ts > close + FUTURE_SKEW_TOLERANCE_MS) {
      return 'stale';
    }
    return 'fresh';
  }
  if (now.getTime() - ts > STALE_THRESHOLD_MS) return 'stale';
  return 'fresh';
}
