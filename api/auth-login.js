// api/auth-login.js
// Autentificare cu email + parola. Emite acelasi tip de token de sesiune ca
// signup-ul.

import { getUser } from './lib/store.js';
import { createSessionToken } from './lib/session.js';
import { verifyPassword } from './lib/password.js';
import { createRateLimiter, getClientIp } from './lib/ratelimit.js';

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

  const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email și parolă necesare' });
  }

  try {
    const user = await getUser(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Email sau parolă incorectă' });
    }

    const token = createSessionToken(email);
    return res.status(200).json({
      success: true,
      token,
      email: user.email,
      memberId: user.memberId,
      lang: user.lang,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
