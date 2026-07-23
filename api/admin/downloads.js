// api/admin/downloads.js
// Returneaza jurnalul complet de descarcari de rapoarte (Upstash - neschimbat).
// Accesul e verificat acum prin Supabase (rolul 'admin' din public.profiles),
// nu mai prin verifySessionToken (tokenul emis la login e acum JWT-ul
// Supabase, nu mai are formatul HMAC vechi).

import { getDownloadLog } from '../_lib/store.js';
import { requireAdmin } from '../_lib/require-admin.js';

export default async function handler(req, res) {
      if (req.method !== 'GET') {
              res.setHeader('Allow', 'GET');
              return res.status(405).json({ error: 'Method not allowed' });
      }

  const access = await requireAdmin(req, res);
      if (!access) return;

  try {
          const downloads = await getDownloadLog(1000);
          return res.status(200).json({ success: true, downloads });
  } catch (err) {
          return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
