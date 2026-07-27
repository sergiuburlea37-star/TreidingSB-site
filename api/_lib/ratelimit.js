// api/lib/ratelimit.js
// Rate limiting pe Upstash Redis (REST, acelasi client ca in _lib/store.js) -
// partajat intre toate instantele/regiunile Vercel, spre deosebire de un Map
// in memorie care se reseteaza la fiecare cold start si nu e vazut de alte
// instante. Fereastra e fixa: o cheie "ratelimit:<namespace>:<ip>" cu INCR +
// expirare setata o singura data, la primul hit din fereastra.
// Daca Redis nu e configurat sau raspunde cu eroare, esuam deschis (nu
// blocam cererea) - rate limiting-ul e o masura suplimentara, nu singura
// aparare (parola/tokenul tot trebuie sa fie corecte).

import { Redis } from '@upstash/redis';

let redisClient;

function getRedis() {
  if (!redisClient) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

export function createRateLimiter({ windowMs, max, namespace }) {
  const windowSec = Math.ceil(windowMs / 1000);

  return async function isRateLimited(ip) {
    const redis = getRedis();
    if (!redis) return false;

    const key = `ratelimit:${namespace}:${ip}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      return count > max;
    } catch (e) {
      return false;
    }
  };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
