const crypto = require("node:crypto");

const MAX_BODY_BYTES = 32 * 1024;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const SCHEMA_VERSION = "1.0";

const ALLOWED_FIELDS = Object.freeze([
  "schema_version",
  "event_id",
  "context_id",
  "created_at",
  "symbol",
  "direction",
  "entry",
  "stop_loss",
  "take_profit",
  "risk_reward",
  "confidence",
  "execution_status",
  "fundamental_status",
  "risk_status",
  "guardrails_status",
  "ai_status",
  "ai_verdict",
  "ai_strength",
  "ai_summary",
  "outcome",
  "closed_at",
]);

// Fields TradingIdeaPayload.__post_init__ (TSB website_integration/schema.py)
// rejects null/None for - mirrors WEBSITE_CONTRACT_REQUIRED_FIELDS in the TSB
// repo's scripts/export_contract.py and contract/trading-idea.v1.schema.json
// "required". The other 11 ALLOWED_FIELDS entries are accepted missing or
// null and are normalized to null below.
const REQUIRED_FIELDS = Object.freeze([
  "schema_version",
  "event_id",
  "created_at",
  "symbol",
  "direction",
  "entry",
  "stop_loss",
  "take_profit",
  "risk_reward",
  "execution_status",
]);

const ALLOWED_OUTCOMES = Object.freeze([
  "OPEN",
  "TP_HIT",
  "SL_HIT",
  "BREAKEVEN",
  "MANUAL_CLOSE",
  "AMBIGUOUS",
  "UNKNOWN",
]);
const FORBIDDEN_TEXT_MARKERS = Object.freeze([
  "anthropic_api_key",
  "fxmacrodata_api_key",
  "supabase_service_role_key",
  "supabase_service_role",
  "supabase_anon_key",
  "password",
  "broker_password",
  "mt5_password",
  "account_credentials",
  "service_role",
  "vercel_token",
  "private_key",
  "raw_response",
  "system_prompt",
  "chain_of_thought",
  "chain-of-thought",
  "thinking",
]);

class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.safeMessage = message;
  }
}

class BodyTooLargeError extends HttpError {
  constructor() {
    super(413, "payload_too_large", "Payload too large.");
  }
}

class AuthError extends HttpError {
  constructor(message = "Unauthorized.") {
    super(401, "unauthorized", message);
  }
}

class ValidationError extends HttpError {
  constructor(message) {
    super(400, "bad_request", message);
  }
}

class NotPublishableError extends HttpError {
  constructor() {
    super(
      400,
      "execution_status_not_publishable",
      "Only execution_status=APPROVED trading ideas are accepted for ingestion."
    );
  }
}

class ConflictError extends HttpError {
  constructor(message) {
    super(409, "conflict", message);
  }
}

class ConfigurationError extends HttpError {
  constructor() {
    super(500, "server_misconfigured", "Server is not configured for ingestion.");
  }
}

class PersistenceError extends HttpError {
  constructor() {
    super(502, "persistence_error", "Trading idea persistence failed.");
  }
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, errorResponse("method_not_allowed", "Method not allowed."), {
        Allow: "POST",
      });
    }

    if (!isJsonContentType(getHeader(req.headers, "content-type"))) {
      return sendJson(
        res,
        415,
        errorResponse("unsupported_media_type", "Content-Type must be application/json.")
      );
    }

    const rawBody = await readRawBody(req, MAX_BODY_BYTES);
    verifySignedRequest({
      headers: req.headers,
      rawBody,
      secret: process.env.TSB_INGEST_SECRET,
      nowMs: Date.now(),
    });

    const parsed = parseJsonObject(rawBody);
    const payload = validateTradingIdeaPayload(parsed);

    if (payload.execution_status !== "APPROVED") {
      throw new NotPublishableError();
    }

    const persistence = req.tsbPersistence || createSupabasePersistence();
    const result = await persistTradingIdea(payload, persistence);

    return sendJson(res, 200, {
      success: true,
      event_id: result.event_id,
      idempotent: result.idempotent,
    });
  } catch (error) {
    return sendSafeError(res, error);
  }
}

function isJsonContentType(value) {
  if (typeof value !== "string") {
    return false;
  }
  return value.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

async function readRawBody(req, limitBytes = MAX_BODY_BYTES) {
  // req.rawBody is an explicit test/mock convenience only - Vercel's runtime
  // never sets it. req.body must NEVER be read here for a live request: HMAC
  // verification needs the exact bytes the client signed, and with
  // config.api.bodyParser=false (see module.exports.config below) req stays
  // an unconsumed Node request stream - req.body is simply never populated
  // by the platform, so reading it would either throw (in tests that guard
  // against this) or silently return nothing useful in production.
  if (typeof req.rawBody === "string" || Buffer.isBuffer(req.rawBody)) {
    const value = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : req.rawBody;
    if (Buffer.byteLength(value, "utf8") > limitBytes) {
      throw new BodyTooLargeError();
    }
    return value;
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > limitBytes) {
        settled = true;
        reject(new BodyTooLargeError());
        if (typeof req.destroy === "function") {
          req.destroy();
        }
        return;
      }
      chunks.push(buffer);
    });

    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    req.on("error", () => {
      if (!settled) {
        settled = true;
        reject(new ValidationError("Could not read request body."));
      }
    });
  });
}

function verifySignedRequest({ headers, rawBody, secret, nowMs = Date.now() }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new ConfigurationError();
  }

  const timestamp = getHeader(headers, "x-tsb-timestamp");
  const signature = getHeader(headers, "x-tsb-signature");
  if (!timestamp || !signature) {
    throw new AuthError();
  }

  const timestampMs = parseTimestampMs(timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new AuthError();
  }

  if (Math.abs(nowMs - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    throw new AuthError();
  }

  const normalizedSignature = normalizeSignature(signature);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!constantTimeHexEqual(normalizedSignature, expected)) {
    throw new AuthError();
  }

  return true;
}

function parseTimestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return NaN;
  }
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return text.length <= 10 ? numeric * 1000 : numeric;
  }
  return Date.parse(text);
}

function normalizeSignature(value) {
  if (typeof value !== "string") {
    throw new AuthError();
  }
  const text = value.trim().toLowerCase();
  const hex = text.startsWith("sha256=") ? text.slice("sha256=".length) : text;
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new AuthError();
  }
  return hex;
}

function constantTimeHexEqual(providedHex, expectedHex) {
  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
}

function parseJsonObject(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (_error) {
    throw new ValidationError("Malformed JSON.");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Payload must be a JSON object.");
  }

  return parsed;
}

function validateTradingIdeaPayload(input) {
  const keys = Object.keys(input);
  for (const key of keys) {
    if (!ALLOWED_FIELDS.includes(key)) {
      throw new ValidationError(`Unknown field: ${key}.`);
    }
  }
  for (const key of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key) || input[key] === null) {
      throw new ValidationError(`Missing field: ${key}.`);
    }
  }

  if (input.schema_version !== SCHEMA_VERSION) {
    throw new ValidationError("Unsupported schema_version.");
  }

  const payload = {
    schema_version: SCHEMA_VERSION,
    event_id: requiredText(input.event_id, "event_id", 160),
    context_id: optionalText(input.context_id, "context_id", 240),
    created_at: parseIsoDatetime(input.created_at, "created_at", true),
    symbol: requiredText(input.symbol, "symbol", 64),
    direction: requiredEnum(input.direction, "direction", ["BUY", "SELL"]),
    entry: finiteNumber(input.entry, "entry"),
    stop_loss: finiteNumber(input.stop_loss, "stop_loss"),
    take_profit: finiteNumber(input.take_profit, "take_profit"),
    risk_reward: finiteNumber(input.risk_reward, "risk_reward"),
    confidence: optionalText(input.confidence, "confidence", 64),
    execution_status: requiredEnum(input.execution_status, "execution_status", ["APPROVED", "BLOCKED"]),
    fundamental_status: optionalText(input.fundamental_status, "fundamental_status", 64),
    risk_status: optionalText(input.risk_status, "risk_status", 64),
    guardrails_status: optionalText(input.guardrails_status, "guardrails_status", 64),
    ai_status: optionalText(input.ai_status, "ai_status", 64),
    ai_verdict: optionalText(input.ai_verdict, "ai_verdict", 64),
    ai_strength: optionalText(input.ai_strength, "ai_strength", 64),
    ai_summary: optionalText(input.ai_summary, "ai_summary", 1000),
    outcome: optionalOutcome(input.outcome),
    closed_at: parseIsoDatetime(input.closed_at, "closed_at", false),
  };

  if (payload.risk_reward <= 0) {
    throw new ValidationError("risk_reward must be positive.");
  }

  if (payload.direction === "BUY" && !(payload.stop_loss < payload.entry && payload.entry < payload.take_profit)) {
    throw new ValidationError("BUY geometry requires stop_loss < entry < take_profit.");
  }
  if (payload.direction === "SELL" && !(payload.take_profit < payload.entry && payload.entry < payload.stop_loss)) {
    throw new ValidationError("SELL geometry requires take_profit < entry < stop_loss.");
  }

  return payload;
}

function requiredText(value, fieldName, maxLength) {
  const text = optionalText(value, fieldName, maxLength);
  if (text === null) {
    throw new ValidationError(`${fieldName} is required.`);
  }
  return text;
}

function optionalText(value, fieldName, maxLength) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }
  const text = value.trim();
  if (text.length === 0) {
    return null;
  }
  if (text.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long.`);
  }
  rejectForbiddenText(text, fieldName);
  return text;
}

function requiredEnum(value, fieldName, allowedValues) {
  const text = requiredText(value, fieldName, 64);
  if (!allowedValues.includes(text)) {
    throw new ValidationError(`${fieldName} has an unsupported value.`);
  }
  return text;
}

function optionalOutcome(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = requiredText(value, "outcome", 32);
  if (!ALLOWED_OUTCOMES.includes(text)) {
    throw new ValidationError("outcome has an unsupported value.");
  }
  return text;
}

function finiteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a finite number.`);
  }
  return value;
}

function parseIsoDatetime(value, fieldName, required) {
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${fieldName} is required.`);
    }
    return null;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be an ISO-8601 datetime or null.`);
  }
  const text = value.trim();
  if (!/([zZ]|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new ValidationError(`${fieldName} must include a timezone.`);
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new ValidationError(`${fieldName} must be a valid ISO-8601 datetime.`);
  }
  return new Date(timestamp).toISOString();
}

function rejectForbiddenText(value, fieldName) {
  const lowered = value.toLowerCase();
  for (const marker of FORBIDDEN_TEXT_MARKERS) {
    if (lowered.includes(marker)) {
      throw new ValidationError(`${fieldName} contains forbidden sensitive text.`);
    }
  }
}

// Canonical fingerprint: delegates to lib/canonical-fingerprint.mjs (the same
// module tests/website-integration.test.mjs exercises directly) instead of
// re-implementing the hashing rules a second time, so the two can no longer
// silently drift apart. Cached after the first call - dynamic import() is the
// only way to load an ESM module from this CommonJS file (see
// api/tsb/package.json "type": "commonjs").
let canonicalFingerprintFn;
async function computePayloadSha256(payload) {
  if (!canonicalFingerprintFn) {
    ({ canonicalFingerprint: canonicalFingerprintFn } = await import("../../lib/canonical-fingerprint.mjs"));
  }
  return canonicalFingerprintFn(payload);
}

// Idempotency model, keyed on event_id (unique, not payload_sha256):
//  - no existing row                                -> insert, created=true
//  - existing row, same canonical payload_sha256     -> 200 idempotent, zero writes
//  - existing row, different canonical payload_sha256 -> 409, existing row untouched
async function persistTradingIdea(payload, persistence) {
  const payloadSha256 = await computePayloadSha256(payload);
  const existing = await persistence.findByEventId(payload.event_id);

  if (!existing) {
    await persistence.upsert(toDatabaseRow(payload, payloadSha256));
    return { event_id: payload.event_id, created: true, idempotent: false, payload_sha256: payloadSha256 };
  }

  if (existing.payload_sha256 === payloadSha256) {
    return { event_id: payload.event_id, created: false, idempotent: true, payload_sha256: payloadSha256 };
  }

  throw new ConflictError("event_id already exists with a different payload.");
}

function toDatabaseRow(payload, payloadSha256) {
  return {
    schema_version: payload.schema_version,
    event_id: payload.event_id,
    context_id: payload.context_id,
    created_at: payload.created_at,
    symbol: payload.symbol,
    direction: payload.direction,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    take_profit: payload.take_profit,
    risk_reward: payload.risk_reward,
    confidence: payload.confidence,
    execution_status: payload.execution_status,
    fundamental_status: payload.fundamental_status,
    risk_status: payload.risk_status,
    guardrails_status: payload.guardrails_status,
    ai_status: payload.ai_status,
    ai_verdict: payload.ai_verdict,
    ai_strength: payload.ai_strength,
    ai_summary: payload.ai_summary,
    outcome: payload.outcome,
    closed_at: payload.closed_at,
    payload_sha256: payloadSha256,
  };
}

function getSupabaseServerKey(env = process.env) {
  return getSupabaseServerCredentials(env).key;
}

function getSupabaseServerCredentials(env = process.env) {
  const secretKey = cleanServerSecret(env.SUPABASE_SECRET_KEY);
  if (secretKey) {
    return { key: secretKey, legacy: false };
  }

  const legacyServiceRoleKey = cleanServerSecret(env.SUPABASE_SERVICE_ROLE_KEY);
  if (legacyServiceRoleKey) {
    return { key: legacyServiceRoleKey, legacy: true };
  }

  throw new ConfigurationError();
}

function cleanServerSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createSupabasePersistence(env = process.env, fetchImpl = globalThis.fetch) {
  const supabaseUrl = env.SUPABASE_URL;
  const credentials = getSupabaseServerCredentials(env);
  if (!supabaseUrl || typeof fetchImpl !== "function") {
    throw new ConfigurationError();
  }

  return {
    async findByEventId(eventId) {
      const url = new URL("/rest/v1/trading_ideas", supabaseUrl);
      url.searchParams.set("event_id", `eq.${eventId}`);
      url.searchParams.set("select", "event_id,payload_sha256");
      url.searchParams.set("limit", "1");
      const response = await fetchImpl(url, {
        method: "GET",
        headers: supabaseHeaders(credentials),
      });
      if (!response.ok) {
        throw new PersistenceError();
      }
      const rows = await response.json();
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },

    async upsert(row) {
      const url = new URL("/rest/v1/trading_ideas", supabaseUrl);
      url.searchParams.set("on_conflict", "event_id");
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          ...supabaseHeaders(credentials),
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([row]),
      });
      if (!response.ok) {
        throw new PersistenceError();
      }
    },
  };
}

function supabaseHeaders(credentials) {
  const headers = {
    apikey: credentials.key,
    Accept: "application/json",
  };

  // Legacy service-role JWTs still require Authorization for REST compatibility.
  if (credentials.legacy) {
    headers.Authorization = `Bearer ${credentials.key}`;
  }

  return headers;
}

function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (Array.isArray(direct)) {
    return direct[0];
  }
  if (direct !== undefined) {
    return direct;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

function sendSafeError(res, error) {
  if (error instanceof HttpError) {
    return sendJson(res, error.statusCode, errorResponse(error.code, error.safeMessage));
  }
  return sendJson(res, 500, errorResponse("internal_error", "Internal server error."));
}

function errorResponse(code, message) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    for (const [name, value] of Object.entries(extraHeaders)) {
      res.setHeader(name, value);
    }
  }
  const body = JSON.stringify(payload);
  if (typeof res.end === "function") {
    res.end(body);
  }
  return body;
}

module.exports = handler;
// Required so Vercel's Node.js runtime does NOT pre-parse/consume the
// request stream into req.body before this handler runs (its default
// bodyParser reads the whole body for application/json, which leaves
// nothing for readRawBody() to read and breaks HMAC verification - the
// signature is computed over exact raw bytes, not a re-parsed payload).
// Same convention already used by api/admin/[name].js in this repo. Must be
// set AFTER `module.exports = handler` above, not before - reassigning
// module.exports replaces whatever was previously attached to it.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
module.exports._internals = {
  ALLOWED_FIELDS,
  REQUIRED_FIELDS,
  MAX_BODY_BYTES,
  TIMESTAMP_TOLERANCE_MS,
  validateTradingIdeaPayload,
  verifySignedRequest,
  persistTradingIdea,
  toDatabaseRow,
  computePayloadSha256,
  createSupabasePersistence,
  getSupabaseServerKey,
  readRawBody,
  parseJsonObject,
};
