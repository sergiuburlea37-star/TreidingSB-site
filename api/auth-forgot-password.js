// api/auth-forgot-password.js
// Cerere de resetare a parolei: primeste un email si, daca exista un profil
// cu acel email in Supabase, genereaza un token de resetare (valabil 1 ora,
// single-use, stocat in Upstash - vezi _lib/store.js, neschimbat) si trimite
// un link prin Resend. Raspunsul e mereu acelasi (200, success:true),
// indiferent daca exista sau nu un cont cu acel email, ca sa nu permita
// enumerarea adreselor inregistrate.

import { createPasswordResetToken, isResetCooldownActive } from './_lib/store.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendPasswordResetEmail } from './_lib/mailer.js';
import { createRateLimiter, getClientIp } from './_lib/ratelimit.js';

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
    const lang = body && typeof body.lang === 'string' ? body.lang : 'ro';

  if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Adresa de email invalida' });
  }

  try {
        const admin = getSupabaseAdmin();
        const { data: profile } = await admin.from('profiles').select('lang').eq('email', email).maybeSingle();

      if (profile) {
              const inCooldown = await isResetCooldownActive(email);
              if (!inCooldown) {
                        const token = await createPasswordResetToken(email);
                        const resetLang = profile.lang || lang;
                        const resetUrl = `https://treidingsb.com/reset-password.html?token=${token}&lang=${encodeURIComponent(resetLang)}`;
                        try {
                                    await sendPasswordResetEmail({ to: email, resetUrl, lang: resetLang });
                        } catch (e) {
                                    console.error('Trimitere email resetare parola esuata:', e.message);
                        }
              }
      }

      return res.status(200).json({ success: true });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
