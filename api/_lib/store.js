// api/lib/store.js
// Wrapper subțire peste Upstash Redis (REST, fără conexiune persistentă —
// potrivit pentru functii serverless Vercel). Stochează un singur obiect JSON
// per utilizator, cheia fiind emailul (lowercase).

import { Redis } from '@upstash/redis';

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
