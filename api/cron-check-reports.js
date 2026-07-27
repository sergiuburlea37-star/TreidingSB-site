// api/cron-check-reports.js
// Declansat de Vercel Cron (vezi vercel.json, "crons") in fiecare luni la
// 20:00 UTC. Face doua lucruri, in ordine:
//
// 1. Sincronizare (best-effort): pentru fiecare limba fara niciun rand in
//    public.reports cu report_date = azi, cauta raportul corespunzator in
//    index.json-ul public al repo-ului treidingsb-reports (generat automat
//    de GitHub Action-ul de acolo) si, daca exista fisierul PDF pentru acea
//    limba specifica, il urca in bucket-ul Supabase Storage "reports-private"
//    si creeaza randul in public.reports cu published:false. Nu "inventeaza"
//    o traducere care nu exista in sursa (nu foloseste PDF-ul RO ca inlocuitor
//    pentru alta limba) - daca fisierul specific lipseste, limba ramane pur
//    si simplu nesincronizata, semnalata mai jos la pasul 2.
//    IMPORTANT: randul creat e intotdeauna published:false. Continutul
//    (analiza de piata, generata de AI in Action-ul extern) ramane
//    intotdeauna supus unei decizii umane explicite de publicare, facuta
//    manual din admin.html - acest job nu publica niciodata singur nimic.
//
// 2. Verificare + alerta: dupa incercarea de sincronizare, verifica ce limbi
//    tot nu au un raport PUBLICAT pentru azi si trimite un singur email catre
//    echipa, distingand doua situatii: limbi complet lipsa (nici in sursa
//    GitHub inca) si limbi deja sincronizate dar care asteapta publicare
//    manuala in admin.html.
//
// De ce 20:00 UTC si nu dimineata: raportul e generat automat de un GitHub
// Action separat (repo treidingsb-reports, cron '0 6 * * 1'), dar GitHub nu
// garanteaza ora exacta pentru rulari programate - in ultimele saptamani
// Action-ul a pornit efectiv intre 13:22 si 17:17 UTC (intarziere de 7-11h
// fata de ora programata), desi rateaza succes de fiecare data. Verificand
// prea devreme (ex. 09:00 UTC) alerta ar declansa fals aproape in fiecare
// saptamana, inainte ca raportul sa existe macar in sursa. 20:00 UTC lasa o
// marja de siguranta dupa cea mai tarzie rulare observata pana acum.
//
// Protejat cu CRON_SECRET (daca e setat in Vercel): Vercel Cron trimite
// automat header-ul Authorization: Bearer <CRON_SECRET> la fiecare apel
// programat - fara el, oricine ar putea declansa endpoint-ul manual (impact
// redus: doar sincronizeaza ca ciorna nepublicata si trimite un email intern,
// dar nu are rost sa fie public accesibil fara motiv).

import { getSupabaseAdmin } from './_lib/supabase.js';

const REPORT_LANGS = ['ro', 'en', 'ru', 'uk', 'pl'];
const REPORTS_INDEX_URL = 'https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/reports/index.json';
const REPORTS_BASE_URL = 'https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/reports/';

async function findTodayEntry(today) {
  try {
    const idxRes = await fetch(REPORTS_INDEX_URL);
    if (!idxRes.ok) return null;
    const idxData = await idxRes.json();
    const list = (idxData && idxData.rapoarte) || [];
    return list.find((r) => r.data === today) || null;
  } catch (e) {
    return null;
  }
}

function relPathForLang(entry, lang) {
  if (entry.fisiere && entry.fisiere[lang]) return entry.fisiere[lang];
  if (lang === 'ro' && entry.fisier) return entry.fisier;
  return null;
}

async function syncReportForLang(admin, entry, lang, today) {
  const relPath = relPathForLang(entry, lang);
  if (!relPath) return false;

  try {
    const pdfRes = await fetch(REPORTS_BASE_URL + relPath);
    if (!pdfRes.ok) return false;
    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    const filePath = `${today}/${lang}/${Date.now()}-sync.pdf`;
    const { error: uploadErr } = await admin
      .storage
      .from('reports-private')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadErr) return false;

    const { error: insertErr } = await admin
      .from('reports')
      .insert({
        title: entry.data_afisare || `Raport ${today}`,
        report_date: today,
        lang,
        file_path: filePath,
        published: false
      });
    if (insertErr) {
      await admin.storage.from('reports-private').remove([filePath]);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: existingRows, error } = await admin
      .from('reports')
      .select('lang, published')
      .eq('report_date', today);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const stateByLang = new Map((existingRows || []).map((r) => [r.lang, r.published]));

    const langsWithoutAnyRow = REPORT_LANGS.filter((lang) => !stateByLang.has(lang));
    if (langsWithoutAnyRow.length > 0) {
      const entry = await findTodayEntry(today);
      if (entry) {
        for (const lang of langsWithoutAnyRow) {
          const synced = await syncReportForLang(admin, entry, lang, today);
          if (synced) stateByLang.set(lang, false);
        }
      }
    }

    const missingCompletely = REPORT_LANGS.filter((lang) => !stateByLang.has(lang));
    const awaitingPublish = REPORT_LANGS.filter((lang) => stateByLang.get(lang) === false);

    if (missingCompletely.length === 0 && awaitingPublish.length === 0) {
      return res.status(200).json({ success: true, allPublished: true });
    }

    const parts = [];
    if (missingCompletely.length > 0) {
      parts.push(`<p>Lipsesc complet (nici sursa GitHub nu are inca fisierul): <b>${missingCompletely.join(', ')}</b></p>`);
    }
    if (awaitingPublish.length > 0) {
      parts.push(`<p>Sincronizate automat, dar asteapta publicare manuala in admin.html: <b>${awaitingPublish.join(', ')}</b></p>`);
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
        subject: `Raportul saptamanal din ${today} nu e complet publicat`,
        html: parts.join('')
      })
    });

    return res.status(200).json({
      success: true,
      allPublished: false,
      missingCompletely,
      awaitingPublish
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
