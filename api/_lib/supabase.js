// api/_lib/supabase.js
// Clienti Supabase pentru functiile serverless Vercel.
//
// - getSupabaseAdmin(): client cu service role key - bypass RLS, doar pentru
//   operatii server-side de incredere (creare cont, resetare parola,
//   verificare existenta profil dupa email, upload fisiere admin).
// - getSupabaseAnon(): client cu anon key - pentru signInWithPassword la
//   login/signup/reset (Supabase Auth are nevoie de contextul "public").
// - getSupabaseForToken(token): client cu anon key + Authorization: Bearer
//   <access_token al utilizatorului> - toate query-urile facute cu acest
//   client trec prin RLS ca utilizatorul respectiv (asta e "securitatea
//   reala": chiar daca un endpoint are un bug, RLS din Postgres tot blocheaza
//   accesul la randuri care nu apartin userului sau nu sunt permise rolului).

import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Supabase not configured (${name} missing)`);
  return value;
}

export function getSupabaseAdmin() {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getSupabaseAnon() {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_ANON_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getSupabaseForToken(token) {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_ANON_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}
