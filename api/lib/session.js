// api/lib/session.js
// Token de sesiune semnat HMAC, in aceeasi familie cu tokenul folosit deja de
// api/verify-access.js — dar de data asta payload-ul contine emailul, ca sa
// stim CINE e logat (nu doar "cineva cu parola comuna").
// Fara stocare de sesiuni in Redis: tokenul e stateless, verificarea e doar
// criptografica + o citire ulterioara a contului pentru date proaspete.

import crypto from 'crypto';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 zile

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken(email) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  const normalizedEmail = String(email).trim().toLowerCase();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, exp: expiresAt }), 'utf8').toString('base64url');
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token || typeof token !== 'string' || !token.includes('.')) return null;

  const dotIndex = token.indexOf('.');
  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expectedSignature = sign(payload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }

  if (!data || typeof data.email !== 'string' || typeof data.exp !== 'number') return null;
  if (data.exp < Date.now()) return null;

  return data.email;
}
