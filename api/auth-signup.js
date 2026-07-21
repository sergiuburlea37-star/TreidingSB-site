// api/auth-signup.js
// Creeaza un cont nou (email + parola). Member ID e derivat determinist din
// email (aceeasi functie folosita si la personalizarea rapoartelor PDF), deci
// ID-ul din cabinet coincide mereu cu cel de pe rapoartele trimise prin email.

import { getUser, createUser } from './lib/store.js';
import { createSessionToken } from './lib/session.js';
import { hashPassword } from './lib/password.js';
import { deriveMemberId } from './lib/personalize-report.js';
import { createRateLimiter, getClientIp } from './lib/ratelimit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

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
  const lang = body && typeof body.lang === 'string' ? body.lang : 'ro';

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresă de email invalidă' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Parola trebuie să aibă minim 8 caractere' });
  }

  try {
    const existing = await getUser(email);
    if (existing) {
      return res.status(409).json({ error: 'Există deja un cont cu acest email' });
    }

    const memberId = deriveMemberId(email);
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    await createUser({ email, passwordHash, memberId, lang, createdAt });

    const token = createSessionToken(email);
    return res.status(200).json({ success: true, token, email, memberId, lang, createdAt });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
