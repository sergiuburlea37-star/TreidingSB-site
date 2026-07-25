// api/auth-login.js
// Autentificare cu email + parola, prin Supabase Auth. Tokenul returnat este
// acum access_token-ul JWT emis de Supabase (nu mai e semnat cu
// SESSION_SECRET) - dar contractul raspunsului catre client ramane identic.

import { createClient } from '@supabase/supabase-js';
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

  const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body && typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
        return res.status(400).json({ error: 'Email si parola necesare' });
  }

  try {
        const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: signedIn, error } = await anon.auth.signInWithPassword({ email, password });

      if (error || !signedIn.session) {
              return res.status(401).json({ error: 'Email sau parola incorecta' });
      }

      const admin = getSupabaseAdmin();
        const { data: profile } = await admin
          .from('profiles')
          .select('member_id, lang, created_at')
          .eq('id', signedIn.user.id)
          .maybeSingle();

      return res.status(200).json({
              success: true,
              token: signedIn.session.access_token,
              email,
              memberId: profile ? profile.member_id : null,
              lang: profile ? profile.lang : 'ro',
              createdAt: profile ? profile.created_at : signedIn.user.created_at
      });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
