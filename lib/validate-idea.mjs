export const SCHEMA_VERSION = "1.0";

export const ALLOWED_FIELDS = Object.freeze([
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

const ALLOWED_OUTCOMES = Object.freeze([
  "OPEN",
  "TP_HIT",
  "SL_HIT",
  "BREAKEVEN",
  "MANUAL_CLOSE",
  "AMBIGUOUS",
  "UNKNOWN",
]);

export function validateTradingIdeaPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Payload must be a JSON object.");
  }

  const keys = Object.keys(input);
  for (const key of keys) {
    if (!ALLOWED_FIELDS.includes(key)) {
      throw new Error(`Unknown field: ${key}.`);
    }
  }

  for (const key of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      throw new Error(`Missing field: ${key}.`);
    }
  }

  if (input.schema_version !== SCHEMA_VERSION) {
    throw new Error("Unsupported schema_version.");
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
    throw new Error("risk_reward must be positive.");
  }

  if (payload.direction === "BUY" && !(payload.stop_loss < payload.entry && payload.entry < payload.take_profit)) {
    throw new Error("BUY geometry requires stop_loss < entry < take_profit.");
  }
  if (payload.direction === "SELL" && !(payload.take_profit < payload.entry && payload.entry < payload.stop_loss)) {
    throw new Error("SELL geometry requires take_profit < entry < stop_loss.");
  }

  return payload;
}

export function requiredText(value, fieldName, maxLength) {
  const text = optionalText(value, fieldName, maxLength);
  if (text === null) {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

export function optionalText(value, fieldName, maxLength) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }

  const text = value.trim();
  if (text.length === 0) {
    return null;
  }
  if (text.length > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }

  rejectForbiddenText(text, fieldName);
  return text;
}

export function requiredEnum(value, fieldName, allowedValues) {
  const text = requiredText(value, fieldName, 64);
  if (!allowedValues.includes(text)) {
    throw new Error(`${fieldName} has an unsupported value.`);
  }
  return text;
}

export function optionalOutcome(value) {
  if (value === null) {
    return null;
  }
  const text = requiredText(value, "outcome", 32);
  if (!ALLOWED_OUTCOMES.includes(text)) {
    throw new Error("outcome has an unsupported value.");
  }
  return text;
}

export function finiteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }
  return value;
}

export function parseIsoDatetime(value, fieldName, required) {
  if (value === null) {
    if (required) {
      throw new Error(`${fieldName} is required.`);
    }
    return null;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be an ISO-8601 datetime or null.`);
  }

  const text = value.trim();
  if (!/([zZ]|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new Error(`${fieldName} must include a timezone.`);
  }

  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO-8601 datetime.`);
  }

  return new Date(timestamp).toISOString();
}

export function rejectForbiddenText(value, fieldName) {
  const lowered = value.toLowerCase();
  for (const marker of FORBIDDEN_TEXT_MARKERS) {
    if (lowered.includes(marker)) {
      throw new Error(`${fieldName} contains forbidden sensitive text.`);
    }
  }
}

export const validateIdea = validateTradingIdeaPayload;
export default {
  SCHEMA_VERSION,
  ALLOWED_FIELDS,
  validateTradingIdeaPayload,
  validateIdea,
};
