import crypto from "crypto";

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isTokenValid(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const dotIndex = token.indexOf(".");
  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expectedSignature = sign(payload, secret);
  return timingSafeEqual(signature, expectedSignature);
}

// Conținutul real al ideilor de tranzacționare trăiește doar aici, pe server.
// Nu este trimis către client decât după ce tokenul e verificat mai jos, deci
// nu apare deloc în codul sursă al paginii pentru vizitatorii neautentificați.
const IDEAS = [
  {
    ticker: "XAU/USD",
    side: "SELL",
    entry: "4040–4050",
    sl: "4097",
    tp: "4000 / 3975",
    riskKey: "ideas.card1.riskValue",
    noteKey: "ideas.card1.note"
  },
  {
    ticker: "EUR/USD",
    side: "BUY",
    entry: "1.0870",
    sl: "1.0820",
    tp: "1.0950",
    riskKey: "ideas.card2.riskValue",
    noteKey: "ideas.card2.note"
  }
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tokenSecret = process.env.MEMBER_TOKEN_SECRET;
  if (!tokenSecret) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!isTokenValid(token, tokenSecret)) {
    return res.status(401).json({ error: "Acces neautorizat" });
  }

  return res.status(200).json({ success: true, ideas: IDEAS });
}
