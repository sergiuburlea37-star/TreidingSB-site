// tests/keepalive.test.mjs
// Teste unitare pentru api/cron/keepalive.js. Nu ating Supabase: clientul e
// injectat prin createKeepaliveHandler(getClient).
//
// Rulare: node --test tests/keepalive.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeepaliveHandler } from '../api/cron/keepalive.js';

const SECRET = 'test-cron-secret-value';
const DB_ROW_ID = '11111111-2222-3333-4444-555555555555';
const SUPABASE_ERROR = 'connection refused service_role_key=sb_secret_leak';

function fakeClient({ error = null } = {}) {
  return () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({ data: error ? null : [{ id: DB_ROW_ID }], error }),
      }),
    }),
  });
}

// Apeleaza handler-ul si captureaza tot ce scrie in console.error (Vercel Logs).
async function call(handler, { method = 'GET', auth } = {}) {
  const out = { headers: {}, logs: [] };
  const res = {
    setHeader(k, v) { out.headers[k] = v; },
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
  };
  const headers = auth ? { authorization: auth } : {};
  const originalError = console.error;
  console.error = (...args) => { out.logs.push(args.map(String).join(' ')); };
  try {
    await handler({ method, headers }, res);
  } finally {
    console.error = originalError;
  }
  return out;
}

const FORBIDDEN = [SECRET, DB_ROW_ID, SUPABASE_ERROR, 'sb_secret', 'service_role'];

function assertNoLeak(out) {
  const body = JSON.stringify(out.body);
  const logs = out.logs.join('\n');
  for (const s of FORBIDDEN) {
    assert.ok(!body.includes(s), `raspunsul contine "${s}": ${body}`);
    assert.ok(!logs.includes(s), `logul contine "${s}": ${logs}`);
  }
  assert.equal(out.headers['Cache-Control'], 'no-store');
}

function withSecret(value, fn) {
  return async () => {
    const prev = process.env.CRON_SECRET;
    if (value === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = value;
    try { await fn(); } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  };
}

test('CRON_SECRET absent -> 500', withSecret(undefined, async () => {
  const out = await call(createKeepaliveHandler(fakeClient()), { auth: `Bearer ${SECRET}` });
  assert.equal(out.status, 500);
  assert.deepEqual(out.body, { error: 'Cron configuration error' });
  assert.deepEqual(out.logs, ['CRON_SECRET lipsește']);
  assertNoLeak(out);
}));

test('secret gresit -> 401', withSecret(SECRET, async () => {
  const out = await call(createKeepaliveHandler(fakeClient()), { auth: 'Bearer gresit' });
  assert.equal(out.status, 401);
  assertNoLeak(out);
}));

test('fara header Authorization -> 401', withSecret(SECRET, async () => {
  const out = await call(createKeepaliveHandler(fakeClient()));
  assert.equal(out.status, 401);
  assertNoLeak(out);
}));

test('metoda diferita de GET -> 405 cu Allow: GET', withSecret(SECRET, async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    const out = await call(createKeepaliveHandler(fakeClient()), { method, auth: `Bearer ${SECRET}` });
    assert.equal(out.status, 405, method);
    assert.equal(out.headers.Allow, 'GET');
    assertNoLeak(out);
  }
}));

test('secret corect + Supabase functional -> 200 fara date', withSecret(SECRET, async () => {
  const out = await call(createKeepaliveHandler(fakeClient()), { auth: `Bearer ${SECRET}` });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { ok: true });
  assert.deepEqual(out.logs, []);
  assertNoLeak(out);
}));

test('eroare Supabase -> 500 fara detalii', withSecret(SECRET, async () => {
  const out = await call(createKeepaliveHandler(fakeClient({ error: { message: SUPABASE_ERROR } })), { auth: `Bearer ${SECRET}` });
  assert.equal(out.status, 500);
  assert.deepEqual(out.body, { error: 'Supabase keepalive failed' });
  assert.deepEqual(out.logs, ['Supabase keepalive failed']);
  assertNoLeak(out);
}));

test('client Supabase care arunca (ex. env lipsa) -> 500 fara detalii', withSecret(SECRET, async () => {
  const throwing = () => { throw new Error(SUPABASE_ERROR); };
  const out = await call(createKeepaliveHandler(throwing), { auth: `Bearer ${SECRET}` });
  assert.equal(out.status, 500);
  assert.deepEqual(out.logs, ['Supabase keepalive failed']);
  assertNoLeak(out);
}));
