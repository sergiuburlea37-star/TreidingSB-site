// api/auth-reset-password.js
// Finalizeaza resetarea parolei: primeste tokenul din link + parola noua,
// valideaza tokenul (single-use, expira in 1 ora), actualizeaza parola si
// autentifica automat utilizatorul (returneaza un token de sesiune, la fel
// ca auth-login.js / auth-signup.js).

import { consumePasswordResetToken, updateUser } from './_lib/store.js';
import { hashPassword } from './_lib/password.js';
import { createSessionToken } from './_lib/session.js';
import { createRateLimiter, getClientIp } from './_lib/ratelimit.js';

const isRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

if (isRateLimited(getClientIp(req))) {
  return res.status(429).json({ error: 'Too many requests. Please try again later.' });
}

let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
  }

const token = body && typeof body.token === 'string' ? body.token.trim() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';

if (!token) {
  return res.status(400).json({ error: 'Link invalid sau expirat' });
}
  if (password.length < 8) {
    return res.status(400).json({ error: 'Parola trebuie sa aiba minim 8 caractere' });
  }

try {
  const email = await consumePasswordResetToken(token);
  if (!email) {
    return res.status(400).json({ error: 'Link invalid sau expirat' });
  }

  const passwordHash = hashPassword(password);
  const updated = await updateUser(email, { passwordHash, passwordResetAt: new Date().toISOString() });
  if (!updated) {
    return res.status(400).json({ error: 'Cont inexistent' });
  }

  const sessionToken = createSessionToken(email);
  return res.status(200).json({
    success: true,
    token: sessionToken,
    email: updated.email,
    memberId: updated.memberId,
    lang: updated.lang,
    createdAt: updated.createdAt
  });
} catch (err) {
  return res.status(500).json({ error: 'Server error: ' + err.message });
}
}
