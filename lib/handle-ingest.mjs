import { canonicalFingerprint } from "./canonical-fingerprint.mjs";
import { validateTradingIdeaPayload } from "./validate-idea.mjs";
import { verifySignedRequest } from "./verify-signature.mjs";

export async function handleIngest({
  rawBody,
  headers = {},
  secret,
  nowMs = Date.now(),
  persistence,
  onPersist,
}) {
  if (typeof rawBody !== "string") {
    throw new Error("Request body must be a string.");
  }

  verifySignedRequest({ headers, rawBody, secret, nowMs });

  const parsed = JSON.parse(rawBody);
  const payload = validateTradingIdeaPayload(parsed);
  const payloadSha256 = canonicalFingerprint(payload);

  const row = {
    ...payload,
    payload_sha256: payloadSha256,
  };

  if (typeof persistence?.upsert === "function") {
    await persistence.upsert(row);
  } else if (typeof onPersist === "function") {
    await onPersist(row);
  }

  return { payload, payload_sha256: payloadSha256, row };
}

export default handleIngest;
