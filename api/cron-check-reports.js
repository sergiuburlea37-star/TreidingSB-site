// api/cron-check-reports.js
// Declansat de Vercel Cron (vezi vercel.json, "crons") in fiecare luni
// dimineata. Verifica daca exista deja, pentru fiecare limba, un raport
// publicat cu report_date = azi in public.reports (Supabase) - daca lipseste
// macar una, trimite un email de alerta catre echipa, ca lipsa sa fie
// observata imediat, nu abia cand intreaba un membru. Nu genereaza sau
// publica niciun raport - continutul (analiza de piata) ramane intotdeauna
// o decizie umana, facuta manual din admin.html.
//
// Protejat cu CRON_SECRET (daca e setat in Vercel): Vercel Cron trimite
// automat header-ul Authorization: Bearer <CRON_SECRET> la fiecare apel
// programat - fara el, oricine ar putea declansa endpoint-ul manual (impact
// redus, doar citeste si trimite un email intern, dar nu are rost sa fie
// public accesibil fara motiv).

import { getSupabaseAdmin } from './_lib/supabase.js';

const REPORT_LANGS = ['ro', 'en', 'ru', 'uk', 'pl'];

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: reports, error } = await admin
      .from('reports')
      .select('lang')
      .eq('report_date', today)
      .eq('published', true);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const publishedLangs = new Set((reports || []).map((r) => r.lang));
    const missingLangs = REPORT_LANGS.filter((lang) => !publishedLangs.has(lang));

    if (missingLangs.length === 0) {
      return res.status(200).json({ success: true, allPublished: true });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TreidingSB <semnale@treidingsb.com>',
        to: ['semnale@treidingsb.com'],
        subject: `Raportul saptamanal din ${today} lipseste (${missingLangs.join(', ')})`,
        html: `<p>Raportul saptamanal pentru <b>${today}</b> nu a fost inca publicat pentru limbile: <b>${missingLangs.join(', ')}</b>.</p><p>Publica-l din admin.html cat mai curand.</p>`
      })
    });

    return res.status(200).json({ success: true, allPublished: false, missingLangs });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
