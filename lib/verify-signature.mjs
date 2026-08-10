import crypto from "node:crypto";

export function parseTimestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return Number.NaN;
  }

  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return text.length <= 10 ? numeric * 1000 : numeric;
  }

  const dateValue = Date.parse(text);
  return Number.isFinite(dateValue) ? dateValue : Number.NaN;
}

export function normalizeSignature(value) {
  if (typeof value !== "string") {
    throw new Error("Signature must be a string.");
  }

  const text = value.trim().toLowerCase();
  const hex = text.startsWith("sha256=") ? text.slice("sha256=".length) : text;
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new Error("Signature must be a valid SHA-256 hex digest.");
  }

  return hex;
}

export function getHeader(headers, name) {
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

export function constantTimeHexEqual(providedHex, expectedHex) {
  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
}

export function verifySignature({ headers, rawBody, secret, nowMs = Date.now() }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("Missing TSB ingest secret.");
  }

  const timestamp = getHeader(headers, "x-tsb-timestamp");
  const signature = getHeader(headers, "x-tsb-signature");
  if (!timestamp || !signature) {
    throw new Error("Missing signature headers.");
  }

  const timestampMs = parseTimestampMs(timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new Error("Invalid timestamp.");
  }

  if (Math.abs(nowMs - timestampMs) > 5 * 60 * 1000) {
    throw new Error("Signature timestamp is outside tolerance.");
  }

  const normalizedSignature = normalizeSignature(signature);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!constantTimeHexEqual(normalizedSignature, expected)) {
    throw new Error("Signature does not match the request body.");
  }

  return true;
}

export const verifySignedRequest = verifySignature;
export default {
  parseTimestampMs,
  normalizeSignature,
  getHeader,
  constantTimeHexEqual,
  verifySignature,
  verifySignedRequest,
};
