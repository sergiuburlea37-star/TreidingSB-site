import crypto from "node:crypto";

export function canonicalizePayload(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizePayload(entry));
  }

  if (value && typeof value === "object") {
    const ordered = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) {
        continue;
      }
      ordered[key] = canonicalizePayload(value[key]);
    }
    return ordered;
  }

  return value;
}

export function canonicalFingerprint(payload) {
  const normalized = canonicalizePayload(payload);
  const json = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(json, "utf8").digest("hex");
}

export const computeCanonicalFingerprint = canonicalFingerprint;
export const canonicalizeIdea = canonicalizePayload;
export default {
  canonicalizePayload,
  canonicalFingerprint,
  computeCanonicalFingerprint,
};
