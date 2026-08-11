// api/auth/[action].js
// Endpoint unificat pentru autentificare: login, signup, me, forgot-password,
// reset-password. Consolidat intr-un singur Serverless Function (ruta
// dinamica [action]) ca sa respecte limita de 12 functii de pe planul Hobby -
// acelasi tipar ca api/admin/[name].js. Comportamentul fiecarei rute (metode
// acceptate, coduri 200/400/401/405/429/500, validarile, rate limiting-ul,
// contractul raspunsurilor JSON) ramane neschimbat fata de fisierele separate
// pe care le inlocuieste: auth-login.js, auth-signup.js, auth-me.js,
// auth-forgot-password.js, auth-reset-password.js. Fiecare handler de mai jos
// e mutat aproape 1:1 din fisierul vechi corespunzator (inclusiv duplicarea
// parsarii body-ului JSON intre handlere - acelasi tipar folosit deja in
// api/admin/[name].js, ca sa nu introduca o abstractie noua neverificata).

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { getAccessInfo } from '../_lib/access.js';
import { createRateLimiter, getClientIp } from '../_lib/ratelimit.js';
import { createPasswordResetToken, isResetCooldownActive, consumePasswordResetToken } from '../_lib/store.js';
import { sendPasswordResetEmail } from '../_lib/mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isLoginRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, namespace: 'login' });
const isSignupRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, namespace: 'signup' });
const isForgotPasswordRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, namespace: 'forgot-password' });
const isResetPasswordRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, namespace: 'reset-password' });

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'login') return handleLogin(req, res);
  if (action === 'signup') return handleSignup(req, res);
  if (action === 'me') return handleMe(req, res);
  if (action === 'forgot-password') return handleForgotPassword(req, res);
  if (action === 'reset-password') return handleResetPassword(req, res);

  return res.status(404).json({ error: 'Not found' });
}

// ---------------------------------------------------------------------------
// login  (fost api/auth-login.js)
// Autentificare cu email + parola, prin Supabase Auth. Tokenul returnat este
// access_token-ul JWT emis de Supabase - contractul raspunsului catre client
// ramane identic.
// ---------------------------------------------------------------------------
async function handleLogin(req, res) {
    if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  if (await isLoginRateLimited(getClientIp(req))) {
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

// ---------------------------------------------------------------------------
// signup  (fost api/auth-signup.js)
// Creeaza un cont nou in Supabase Auth (email + parola). La creare, un
// trigger din baza de date (handle_new_user) creeaza automat randul
// corespunzator in public.profiles (cu member_id derivat din user id) si in
// public.subscriptions (status 'inactive').
// ---------------------------------------------------------------------------
async function handleSignup(req, res) {
    if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  if (await isSignupRateLimited(getClientIp(req))) {
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
              console.error('auth-signup createUser error:', { status: createErr.status, code: createErr.code, message: createErr.message });
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

// ---------------------------------------------------------------------------
// me  (fost api/auth-me.js)
// Returneaza datele contului curent pe baza tokenului Supabase (Authorization:
// Bearer <token>). Folosit de cabinet ca sa randeze mesajul personalizat si sa
// confirme ca sesiunea e inca valida.
// ---------------------------------------------------------------------------
async function handleMe(req, res) {
    if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const access = await getAccessInfo(token);
    if (!access.authenticated) {
          return res.status(401).json({ error: 'Sesiune invalida sau expirata' });
    }

  try {
        if (!access.profile) {
                return res.status(401).json({ error: 'Cont inexistent' });
        }

      return res.status(200).json({
              success: true,
              email: access.email,
              memberId: access.profile.member_id,
              lang: access.profile.lang,
              createdAt: access.profile.created_at,
              role: access.profile.role,
              hasActiveSub: access.hasActiveSub
      });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

// ---------------------------------------------------------------------------
// forgot-password  (fost api/auth-forgot-password.js)
// Cerere de resetare a parolei: primeste un email si, daca exista un profil
// cu acel email in Supabase, genereaza un token de resetare (valabil 1 ora,
// single-use, stocat in Upstash - vezi _lib/store.js, neschimbat) si trimite
// un link prin Resend. Raspunsul e mereu acelasi (200, success:true),
// indiferent daca exista sau nu un cont cu acel email, ca sa nu permita
// enumerarea adreselor inregistrate.
// ---------------------------------------------------------------------------
async function handleForgotPassword(req, res) {
    if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  if (await isForgotPasswordRateLimited(getClientIp(req))) {
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

// ---------------------------------------------------------------------------
// reset-password  (fost api/auth-reset-password.js)
// Finalizeaza resetarea parolei: primeste tokenul din link + parola noua,
// valideaza tokenul (single-use, expira in 1 ora, stocat in Upstash),
// actualizeaza parola direct in Supabase Auth si autentifica automat
// utilizatorul (returneaza un token de sesiune Supabase, la fel ca
// handleLogin / handleSignup mai sus).
// ---------------------------------------------------------------------------
async function handleResetPassword(req, res) {
    if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  if (await isResetPasswordRateLimited(getClientIp(req))) {
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
