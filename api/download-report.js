// api/download-report.js
// Livreaza cel mai recent raport publicat, in limba ceruta, doar membrilor cu
// abonament activ (sau admin). Fisierele PDF nu mai stau intr-un repo GitHub
// public - traiesc in bucket-ul privat Supabase Storage "reports-private" -
// iar linkul returnat catre client e un semnat, valabil doar 60 de secunde
// (createSignedUrl), niciodata un URL public permanent.

import { getAccessInfo } from './_lib/access.js';
import { logDownload } from './_lib/store.js';

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

        const [y, m, d] = String(report.report_date).split('-');

        try {
                  await logDownload({
                              email: access.email,
                              memberId: access.profile ? access.profile.member_id : null,
                              timestamp: Date.now(),
                              reportDate: report.report_date,
                              lang
                  });
        } catch (e) {
                  // jurnalul de descarcari e best-effort, nu blocam livrarea raportului
            console.error('logDownload failed:', e.message);
        }

        return res.status(200).json({ success: true, url: signed.signedUrl, dateStr: `${d}.${m}.${y}` });
  } catch (err) {
          return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
