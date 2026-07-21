// api/lib/ratelimit.js
// Acelasi model simplu, in-memory per instanta, ca in api/send-email.js —
// nu e distribuit, dar opreste rafalele simple pe aceeasi conexiune.

export function createRateLimiter({ windowMs, max }) {
  const store = new Map();
  return function isRateLimited(ip) {
    const now = Date.now();
    const entry = store.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      store.set(ip, { windowStart: now, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
