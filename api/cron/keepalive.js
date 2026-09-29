// api/cron/keepalive.js
// Declansat zilnic de Vercel Cron (vezi vercel.json, "crons"). Face o singura
// citire minima in Supabase (cel mult un id din public.profiles, nereturnat),
// ca solutie temporara si neoficiala impotriva pauzei automate a proiectelor
// de pe planul Free dupa ~7 zile fara activitate. Supabase nu garanteaza ca
// aceasta activitate impiedica pauza; singura garantie oficiala e planul Pro.
//
// Esecurile sunt doar inregistrate in Vercel Logs (console.error), cu mesaje
// fixe, fara detalii din exceptie. Nu exista alertare automata.
//
// Cheia service role e folosita numai aici, pe server, prin getSupabaseAdmin();
// nu apare in raspuns si nu e scrisa in log.

import { getSupabaseAdmin } from '../_lib/supabase.js';

export function createKeepaliveHandler(getClient = getSupabaseAdmin) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization || '';

    if (!cronSecret) {
      console.error('CRON_SECRET lipsește');
      return res.status(500).json({ error: 'Cron configuration error' });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { error } = await getClient().from('profiles').select('id').limit(1);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    } catch {
      console.error('Supabase keepalive failed');
      return res.status(500).json({ error: 'Supabase keepalive failed' });
    }
  };
}

export default createKeepaliveHandler();
