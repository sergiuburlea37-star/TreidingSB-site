// api/download-report.js
// Livreaza cel mai recent raport publicat, in limba ceruta, doar membrilor cu
// abonament activ (sau admin). Fisierele PDF nu mai stau intr-un repo GitHub
// public - traiesc in bucket-ul privat Supabase Storage "reports-private" -
// iar linkul returnat catre client e un semnat, valabil doar 60 de secunde
// (createSignedUrl), niciodata un URL public permanent.
//
// Evidenta ("audit trail"): fiecare URL semnat generat cu succes este
// inregistrat in Supabase (public.report_downloads) INAINTE de a fi livrat
// clientului. Daca inregistrarea esueaza, NU livram URL-ul - vezi
// recordReportDownload in api/_lib/report-downloads.js si migrarea
// supabase/migrations/202607230001_report_downloads.sql (neaplicata inca,
// necesita aprobare/rulare separata).

import { getAccessInfo } from './_lib/access.js';
import { recordReportDownload } from './_lib/report-downloads.js';

const REPORT_LANGS = ['ro', 'en', 'ru', 'uk', 'pl'];

export default async function handler(req, res) {
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
  if (!access.isAdmin && !access.hasActiveSub) {
    return res.status(403).json({ error: 'Necesita abonament activ', requiresSubscription: true });
  }

  try {
    const requestedLang = req.query && req.query.lang;
    const lang = REPORT_LANGS.includes(requestedLang) ? requestedLang : (access.profile && access.profile.lang) || 'ro';

    const { data: report, error } = await access.client
      .from('reports')
      .select('id, title, report_date, file_path')
      .eq('lang', lang)
      .eq('published', true)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !report) {
      return res.status(200).json({ success: false });
    }

    const { data: signed, error: signErr } = await access.client
      .storage
      .from('reports-private')
      .createSignedUrl(report.file_path, 60);

    if (signErr || !signed) {
      return res.status(200).json({ success: false });
    }

    // Inregistrarea de audit se scrie INAINTE de a livra URL-ul semnat: daca
    // esueaza, intoarcem o eroare controlata si NU livram URL-ul, ca sa
    // garantam ca fiecare URL livrat are o inregistrare corespunzatoare in
    // report_downloads (cerinta: fiecare accesare generata = o inregistrare).
    try {
      await recordReportDownload({
        userId: access.userId,
        reportId: report.id,
        memberId: access.profile ? access.profile.member_id : null,
        lang
      });
    } catch (auditErr) {
      console.error('recordReportDownload failed:', auditErr.message);
      return res.status(500).json({ error: 'Nu am putut inregistra descarcarea. Te rugam sa incerci din nou.' });
    }

    const [y, m, d] = String(report.report_date).split('-');

    return res.status(200).json({ success: true, url: signed.signedUrl, dateStr: `${d}.${m}.${y}` });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
