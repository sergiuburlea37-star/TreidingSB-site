// api/auth-signup.js
// Creeaza un cont nou in Supabase Auth (email + parola). La creare, un
// trigger din baza de date (handle_new_user) creeaza automat randul
// corespunzator in public.profiles (cu member_id derivat din user id) si in
// public.subscriptions (status 'inactive'). Contractul raspunsului ramane
// identic cu versiunea veche (Upstash), ca sa nu fie nevoie de nicio
// modificare in script.js.

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabase.js';
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
    const password = body && typeof body.password === 'string' ? body.password : '';
    const lang = body && typeof body.lang === 'string' ? body.lang : 'ro';

  if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Adresa de email invalida' });
  }
    if (password.length < 8) {
          return res.status(400).json({ error: 'Parola trebuie sa aiba minim 8 caractere' });
    }

  try {
        const admin = getSupabaseAdmin();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { lang }
      });

      if (createErr) {
              const msg = String(createErr.message || '').toLowerCase();
              if (msg.includes('already') || msg.includes('exist')) {
                        return res.status(409).json({ error: 'Exista deja un cont cu acest email' });
              }
              return res.status(400).json({ error: createErr.message || 'Nu am putut crea contul' });
      }

      const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
              auth: { autoRefreshToken: false, persistSession: false }
      });
        const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
        if (signInErr || !signedIn.session) {
                return res.status(500).json({ error: 'Cont creat, dar autentificarea automata a esuat. Incearca sa te loghezi.' });
        }

      const { data: profile } = await admin
          .from('profiles')
          .select('member_id, lang, created_at')
          .eq('id', created.user.id)
          .maybeSingle();

      return res.status(200).json({
              success: true,
              token: signedIn.session.access_token,
              email,
              memberId: profile ? profile.member_id : null,
              lang: profile ? profile.lang : lang,
              createdAt: profile ? profile.created_at : created.user.created_at
      });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
