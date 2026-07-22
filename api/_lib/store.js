// api/lib/store.js
// Wrapper subțire peste Upstash Redis (REST, fără conexiune persistentă -
// potrivit pentru functii serverless Vercel). Stochează un singur obiect JSON
// per utilizator, cheia fiind emailul (lowercase).

import { Redis } from '@upstash/redis';
import crypto from 'crypto';

let redisClient;

function getRedis() {
  if (!redisClient) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('Redis not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing)');
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

function userKey(email) {
  return `user:${String(email).trim().toLowerCase()}`;
}

export async function getUser(email) {
  const redis = getRedis();
  const user = await redis.get(userKey(email));
  return user || null;
}

export async function createUser(user) {
  const redis = getRedis();
  await redis.set(userKey(user.email), user);
  return user;
}

export async function updateUser(email, patch) {
  const redis = getRedis();
  const existing = await getUser(email);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await redis.set(userKey(email), updated);
  return updated;
}

export async function logDownload(entry) {
  const redis = getRedis();
  await redis.lpush('downloads:log', JSON.stringify(entry));
}

export async function getDownloadLog(limit = 1000) {
  const redis = getRedis();
  const raw = await redis.lrange('downloads:log', 0, limit - 1);
  return raw.map((item) => {
    try {
      return typeof item === 'string' ? JSON.parse(item) : item;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

// ---------- Resetare parolă (token expirabil, single-use) ----------
// Tokenul e generat cu crypto.randomBytes si stocat in Redis doar sub forma
// de hash SHA-256 - daca cineva ar avea acces la Redis, tot n-ar putea
// folosi direct valoarea stocata ca token de resetare valid. Ambele chei
// (token -> email si email -> token curent) au acelasi TTL, ca sa poata fi
// invalidat automat tokenul vechi cand se cere unul nou pentru acelasi cont.

const RESET_TOKEN_TTL_SEC = 60 * 60; // 1 ora
const RESET_COOLDOWN_SEC = 60; // maxim o cerere de resetare pe minut per email

function resetTokenKey(tokenHash) {
  return `reset:${tokenHash}`;
}

function resetUserKey(email) {
  return `resetuser:${String(email).trim().toLowerCase()}`;
}

function resetCooldownKey(email) {
  return `resetcooldown:${String(email).trim().toLowerCase()}`;
}

export async function createPasswordResetToken(email) {
  const redis = getRedis();
  const normalizedEmail = String(email).trim().toLowerCase();

const oldHash = await redis.get(resetUserKey(normalizedEmail));
  if (oldHash) await redis.del(resetTokenKey(oldHash));

const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

await redis.set(resetTokenKey(tokenHash), normalizedEmail, { ex: RESET_TOKEN_TTL_SEC });
  await redis.set(resetUserKey(normalizedEmail), tokenHash, { ex: RESET_TOKEN_TTL_SEC });

return token;
}

export async function consumePasswordResetToken(token) {
  const redis = getRedis();
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const email = await redis.get(resetTokenKey(tokenHash));
  if (!email) return null;

await redis.del(resetTokenKey(tokenHash));
  await redis.del(resetUserKey(email));

return email;
}

export async function isResetCooldownActive(email) {
  const redis = getRedis();
  const result = await redis.set(resetCooldownKey(email), '1', { ex: RESET_COOLDOWN_SEC, nx: true });
  return result !== 'OK';
}
