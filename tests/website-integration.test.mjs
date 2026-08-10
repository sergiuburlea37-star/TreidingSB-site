import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { canonicalFingerprint } from "../lib/canonical-fingerprint.mjs";
import { handleIngest } from "../lib/handle-ingest.mjs";
import { validateTradingIdeaPayload } from "../lib/validate-idea.mjs";
import { verifySignature } from "../lib/verify-signature.mjs";

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
