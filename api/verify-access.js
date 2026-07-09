import crypto from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const memberPassword = process.env.MEMBER_PASSWORD;
  const tokenSecret = process.env.MEMBER_TOKEN_SECRET;

  if (!memberPassword || !tokenSecret) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res.status(400).json({ error: "Invalid request body" });
    }
  }

  const password = body && typeof body.password === "string" ? body.password : "";

  if (!password || !timingSafeEqual(password, memberPassword)) {
    return res.status(401).json({ error: "Parolă incorectă" });
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = String(expiresAt);
  const signature = sign(payload, tokenSecret);
  const token = `${payload}.${signature}`;

  return res.status(200).json({ success: true, token, expiresAt });
}
