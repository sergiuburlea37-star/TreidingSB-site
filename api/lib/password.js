// api/lib/password.js
// Hash de parola cu scrypt (built-in Node, fara dependinta noua). Format
// stocat: "salt_hex:derived_hex".

import crypto from 'crypto';

const KEY_LEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const derived = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(derived, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
