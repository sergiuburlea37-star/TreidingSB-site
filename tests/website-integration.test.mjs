import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { canonicalFingerprint } from "../lib/canonical-fingerprint.mjs";
import { handleIngest } from "../lib/handle-ingest.mjs";
import { validateTradingIdeaPayload } from "../lib/validate-idea.mjs";
import { verifySignature } from "../lib/verify-signature.mjs";

// Real deployed Vercel handler (CommonJS - api/tsb/package.json sets
// "type": "commonjs"). Imported directly so the tests below exercise the
// actual code path Vercel runs for POST /api/tsb/trading-ideas, not just the
// lib/*.mjs helpers above (which api/tsb/trading-ideas.js does not import,
// aside from lib/canonical-fingerprint.mjs for the payload_sha256 hash).
import realHandler from "../api/tsb/trading-ideas.js";

const SECRET = "test-ingest-secret-1234567890";
const NOW = Date.parse("2026-08-09T12:00:00.000Z");

function validPayload(overrides = {}) {
  return {
    schema_version: "1.0",
    event_id: "event-123",
    context_id: "ctx-123",
    created_at: "2026-08-09T11:55:00.000Z",
    symbol: "XAUUSD.s",
    direction: "BUY",
    entry: 4340,
    stop_loss: 4320,
    take_profit: 4370,
    risk_reward: 1.5,
    confidence: "HIGH",
    execution_status: "APPROVED",
    fundamental_status: "SAFE",
    risk_status: "APPROVED",
    guardrails_status: "APPROVED",
    ai_status: "SUCCESS",
    ai_verdict: "SUPPORT",
    ai_strength: "HIGH",
    ai_summary: "Read-only AI summary.",
    outcome: "OPEN",
    closed_at: null,
    ...overrides,
  };
}

function sign(rawBody, timestamp, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

test("contract validation accepts valid payload and rejects invalid geometry", () => {
  const payload = validateTradingIdeaPayload(validPayload());
  assert.equal(payload.direction, "BUY");
  assert.equal(payload.event_id, "event-123");

  assert.throws(() => validateTradingIdeaPayload(validPayload({ direction: "BUY", stop_loss: 5000 })), /BUY geometry/);
  assert.throws(() => validateTradingIdeaPayload(validPayload({ execution_status: "REJECTED" })), /unsupported value/);
});

test("HMAC verification accepts valid signature and rejects stale or bad signatures", () => {
  const rawBody = JSON.stringify(validPayload());
  const timestamp = "2026-08-09T12:00:00.000Z";
  const headers = {
    "x-tsb-timestamp": timestamp,
    "x-tsb-signature": `sha256=${sign(rawBody, timestamp)}`,
  };

  assert.equal(verifySignature({ headers, rawBody, secret: SECRET, nowMs: NOW }), true);
  assert.throws(() => verifySignature({ headers: { ...headers, "x-tsb-signature": "0".repeat(64) }, rawBody, secret: SECRET, nowMs: NOW }), /Signature/);
  assert.throws(() => verifySignature({ headers: { "x-tsb-timestamp": "2026-08-09T11:54:00.000Z", "x-tsb-signature": "sha256=abc" }, rawBody, secret: SECRET, nowMs: NOW }), /Signature/);
});

test("canonical fingerprint is deterministic and stable for equivalent payloads", () => {
  const payload = validPayload();
  const same = validPayload();
  const a = canonicalFingerprint(payload);
  const b = canonicalFingerprint(same);
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, canonicalFingerprint(validPayload({ event_id: "event-999" })));
});

test("handleIngest verifies body, validates payload, and persists payload_sha256", async () => {
  const rawBody = JSON.stringify(validPayload());
  const headers = {
    "x-tsb-timestamp": "2026-08-09T12:00:00.000Z",
    "x-tsb-signature": `sha256=${sign(rawBody, "2026-08-09T12:00:00.000Z")}`,
  };

  const rows = [];
  const result = await handleIngest({
    rawBody,
    headers,
    secret: SECRET,
    nowMs: NOW,
    persistence: {
      async upsert(row) {
        rows.push(row);
      },
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(result.payload_sha256, canonicalFingerprint(result.payload));
  assert.equal(rows[0].payload_sha256, result.payload_sha256);
  assert.equal(rows[0].event_id, "event-123");
});

test("original migration keeps RLS and unique event_id; new payload migration stays additive and non-unique", () => {
  const originalMigrationPath = path.join(process.cwd(), "supabase", "migrations", "202608090001_create_trading_ideas.sql");
  const originalText = fs.readFileSync(originalMigrationPath, "utf8");

  assert.match(originalText, /alter table public\.trading_ideas\s*\n\s*enable row level security/i);
  assert.match(originalText, /event_id\s+text\s+primary key|event_id\s+text.*primary key|alter column event_id set not null/i);
  assert.match(originalText, /create unique index if not exists.*event_id|unique.*event_id/i);

  const newMigrationPath = path.join(process.cwd(), "supabase", "migrations", "202608100001_add_payload_sha256.sql");
  const newText = fs.readFileSync(newMigrationPath, "utf8");

  assert.match(newText, /add column if not exists payload_sha256 text/i);
  assert.doesNotMatch(newText, /create unique index.*payload_sha256|unique.*payload_sha256/i);
  assert.doesNotMatch(newText, /drop table|truncate|delete from public\.trading_ideas/i);
  assert.doesNotMatch(newText, /create policy/i);
  assert.doesNotMatch(newText, /grant .*insert.*anon|grant .*update.*anon|grant .*delete.*anon/i);
  assert.doesNotMatch(newText, /enable row level security/i);
});

test("boundary and safety checks reject forbidden text and oversized values", () => {
  assert.throws(() => validateTradingIdeaPayload(validPayload({ ai_summary: "secret credential password should fail" })), /forbidden sensitive text/);
  assert.throws(() => validateTradingIdeaPayload(validPayload({ ai_summary: "a".repeat(1001) })), /too long/);
});

// =============================================================================
// Real handler tests (api/tsb/trading-ideas.js) - everything below invokes
// `realHandler` directly, with a mock req/res and an injected in-memory
// persistence (req.tsbPersistence). These are the tests that actually prove
// the deployed Vercel function behaves as specified, independent of the
// lib/*.mjs tests above.
// =============================================================================

const REAL_SECRET = "test-real-handler-secret";
const REAL_NOW = Date.parse("2026-08-10T12:00:00.000Z");

function realHandlerValidPayload(overrides = {}) {
  return {
    schema_version: "1.0",
    event_id: "real-event-123",
    context_id: "ctx-real-123",
    created_at: "2026-08-10T11:55:00.000Z",
    symbol: "XAUUSD.s",
    direction: "BUY",
    entry: 4340,
    stop_loss: 4320,
    take_profit: 4370,
    risk_reward: 1.5,
    confidence: "HIGH",
    execution_status: "APPROVED",
    fundamental_status: "SAFE",
    risk_status: "APPROVED",
    guardrails_status: "APPROVED",
    ai_status: "SUCCESS",
    ai_verdict: "SUPPORT",
    ai_strength: "HIGH",
    ai_summary: "Read-only AI summary.",
    outcome: "OPEN",
    closed_at: null,
    ...overrides,
  };
}

function minimalRequiredPayload(overrides = {}) {
  // Only the 10 fields WEBSITE_CONTRACT_REQUIRED_FIELDS marks required - the
  // other 11 keys are genuinely absent (not even present as null), same as
  // an external caller who only fills in what schema.py treats as mandatory.
  return {
    schema_version: "1.0",
    event_id: "real-event-minimal",
    created_at: "2026-08-10T11:55:00.000Z",
    symbol: "XAUUSD.s",
    direction: "BUY",
    entry: 4340,
    stop_loss: 4320,
    take_profit: 4370,
    risk_reward: 1.5,
    execution_status: "APPROVED",
    ...overrides,
  };
}

function signRealHandlerBody(rawBody, timestamp, secret = REAL_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

function makeMockPersistence() {
  const rows = new Map();
  const writes = [];
  return {
    rows,
    writes,
    async findByEventId(eventId) {
      return rows.get(eventId) || null;
    },
    async upsert(row) {
      writes.push(row);
      rows.set(row.event_id, { ...(rows.get(row.event_id) || {}), ...row });
    },
  };
}

class MockResponse {
  constructor() {
    this.statusCode = undefined;
    this.headers = {};
    this.body = undefined;
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  end(body) {
    this.body = body;
  }

  json() {
    return JSON.parse(this.body);
  }
}

async function callRealHandler({
  method = "POST",
  payload,
  rawBody,
  headers,
  timestamp = "2026-08-10T12:00:00.000Z",
  persistence,
  contentType = "application/json",
} = {}) {
  const body = rawBody !== undefined ? rawBody : JSON.stringify(payload !== undefined ? payload : realHandlerValidPayload());
  const signedHeaders = headers !== undefined ? headers : {
    "x-tsb-timestamp": timestamp,
    "x-tsb-signature": signRealHandlerBody(body, timestamp),
  };

  const req = {
    method,
    rawBody: body,
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      ...signedHeaders,
    },
    tsbPersistence: persistence || makeMockPersistence(),
  };
  const res = new MockResponse();

  const oldSecret = process.env.TSB_INGEST_SECRET;
  const oldNow = Date.now;
  process.env.TSB_INGEST_SECRET = REAL_SECRET;
  Date.now = () => REAL_NOW;
  try {
    await realHandler(req, res);
  } finally {
    Date.now = oldNow;
    if (oldSecret === undefined) {
      delete process.env.TSB_INGEST_SECRET;
    } else {
      process.env.TSB_INGEST_SECRET = oldSecret;
    }
  }

  return { res, persistence: req.tsbPersistence };
}

test("real handler: payload with only the 10 required fields is accepted", async () => {
  const { res, persistence } = await callRealHandler({ payload: minimalRequiredPayload() });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().success, true);
  assert.equal(persistence.writes.length, 1);
});

test("real handler: full 21-key payload is accepted", async () => {
  const { res, persistence } = await callRealHandler({ payload: realHandlerValidPayload() });

  assert.equal(res.statusCode, 200);
  assert.equal(persistence.writes.length, 1);
  assert.equal(persistence.writes[0].event_id, "real-event-123");
});

test("real handler: missing optional fields are normalized to null in the persisted row", async () => {
  const { persistence } = await callRealHandler({ payload: minimalRequiredPayload() });
  const row = persistence.writes[0];

  for (const field of [
    "context_id",
    "confidence",
    "fundamental_status",
    "risk_status",
    "guardrails_status",
    "ai_status",
    "ai_verdict",
    "ai_strength",
    "ai_summary",
    "outcome",
    "closed_at",
  ]) {
    assert.equal(row[field], null, `${field} should be normalized to null`);
  }
  assert.equal(Object.keys(row).length, 22, "row must still carry all 21 payload keys plus payload_sha256");
});

test("real handler: missing a truly required field is rejected with 400", async () => {
  const payload = minimalRequiredPayload();
  delete payload.event_id;
  const { res, persistence } = await callRealHandler({ payload });

  assert.equal(res.statusCode, 400);
  assert.match(res.body, /Missing field: event_id/);
  assert.equal(persistence.writes.length, 0);
});

test("real handler: execution_status=BLOCKED is rejected with 400 and zero writes", async () => {
  const { res, persistence } = await callRealHandler({
    payload: realHandlerValidPayload({ execution_status: "BLOCKED" }),
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().success, false);
  assert.equal(persistence.writes.length, 0);
});

test("real handler: new APPROVED event returns HTTP 200", async () => {
  const { res } = await callRealHandler({ payload: realHandlerValidPayload({ event_id: "real-event-new" }) });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.event_id, "real-event-new");
  assert.equal(body.idempotent, false);
});

test("real handler: persisted row contains a valid payload_sha256", async () => {
  const { persistence } = await callRealHandler({ payload: realHandlerValidPayload({ event_id: "real-event-hash" }) });
  const row = persistence.rows.get("real-event-hash");

  assert.match(row.payload_sha256, /^[a-f0-9]{64}$/);
});

test("real handler: identical replay returns 200, idempotent=true, and does not write again", async () => {
  const persistence = makeMockPersistence();
  const payload = realHandlerValidPayload({ event_id: "real-event-replay" });

  const first = await callRealHandler({ payload, persistence });
  assert.equal(first.res.statusCode, 200);
  assert.equal(first.res.json().idempotent, false);
  assert.equal(persistence.writes.length, 1);

  const second = await callRealHandler({ payload, persistence });
  assert.equal(second.res.statusCode, 200);
  const secondBody = second.res.json();
  assert.equal(secondBody.success, true);
  assert.equal(secondBody.idempotent, true);
  assert.equal(persistence.writes.length, 1, "identical replay must not issue a second write");
});

test("real handler: same event_id with a semantically different payload is rejected with 409", async () => {
  const persistence = makeMockPersistence();
  const payload = realHandlerValidPayload({ event_id: "real-event-conflict" });

  await callRealHandler({ payload, persistence });
  const conflicting = await callRealHandler({
    payload: realHandlerValidPayload({ event_id: "real-event-conflict", ai_summary: "A different summary." }),
    persistence,
  });

  assert.equal(conflicting.res.statusCode, 409);
  assert.equal(persistence.writes.length, 1, "conflicting payload must not modify the existing row");
  assert.equal(persistence.rows.get("real-event-conflict").ai_summary, "Read-only AI summary.");
});

test("real handler: invalid HMAC signature is rejected with 401", async () => {
  const body = JSON.stringify(realHandlerValidPayload());
  const { res, persistence } = await callRealHandler({
    rawBody: body,
    headers: { "x-tsb-timestamp": "2026-08-10T12:00:00.000Z", "x-tsb-signature": "0".repeat(64) },
  });

  assert.equal(res.statusCode, 401);
  assert.equal(persistence.writes.length, 0);
});

test("real handler: stale timestamp is rejected with 401", async () => {
  const body = JSON.stringify(realHandlerValidPayload());
  const staleTimestamp = "2026-08-10T11:54:00.000Z"; // 6 minutes before REAL_NOW, tolerance is 5 minutes
  const { res } = await callRealHandler({
    rawBody: body,
    timestamp: staleTimestamp,
    headers: {
      "x-tsb-timestamp": staleTimestamp,
      "x-tsb-signature": signRealHandlerBody(body, staleTimestamp),
    },
  });

  assert.equal(res.statusCode, 401);
});

test("real handler: invalid geometry is rejected with 400", async () => {
  const { res } = await callRealHandler({
    payload: realHandlerValidPayload({ direction: "BUY", entry: 4340, stop_loss: 4350, take_profit: 4370 }),
  });

  assert.equal(res.statusCode, 400);
});

test("real handler: unknown field is rejected with 400", async () => {
  const { res, persistence } = await callRealHandler({
    payload: realHandlerValidPayload({ mt5_password: "leaked" }),
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body, /Unknown field/);
  assert.equal(persistence.writes.length, 0);
});

test("real handler's payload_sha256 matches lib/canonical-fingerprint.mjs computed independently", async () => {
  const { persistence } = await callRealHandler({ payload: realHandlerValidPayload({ event_id: "real-event-fingerprint" }) });
  const row = persistence.rows.get("real-event-fingerprint");

  const { validateTradingIdeaPayload: validateViaLib } = await import("../lib/validate-idea.mjs");
  const normalizedPayload = validateViaLib(realHandlerValidPayload({ event_id: "real-event-fingerprint" }));
  const independentFingerprint = canonicalFingerprint(normalizedPayload);

  assert.equal(row.payload_sha256, independentFingerprint);
});
