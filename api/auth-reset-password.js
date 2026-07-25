// api/auth-reset-password.js
// Finalizeaza resetarea parolei: primeste tokenul din link + parola noua,
// valideaza tokenul (single-use, expira in 1 ora, stocat in Upstash),
// actualizeaza parola direct in Supabase Auth si autentifica automat
// utilizatorul (returneaza un token de sesiune Supabase, la fel ca
// auth-login.js / auth-signup.js).

import { createClient } from '@supabase/supabase-js';
import { consumePasswordResetToken } from './_lib/store.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
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

      const admin = getSupabaseAdmin();
        const { data: profile } = await admin
          .from('profiles')
          .select('id, member_id, lang, created_at')
          .eq('email', email)
          .maybeSingle();
        if (!profile) {
                return res.status(400).json({ error: 'Cont inexistent' });
        }

      const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password });
        if (updateErr) {
                return res.status(500).json({ error: 'Server error: ' + updateErr.message });
        }

      const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
              auth: { autoRefreshToken: false, persistSession: false }
      });
        const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
        if (signInErr || !signedIn.session) {
                return res.status(500).json({ error: 'Parola a fost schimbata, dar autentificarea automata a esuat. Incearca sa te loghezi.' });
        }

      return res.status(200).json({
              success: true,
              token: signedIn.session.access_token,
              email,
              memberId: profile.member_id,
              lang: profile.lang,
              createdAt: profile.created_at
      });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
