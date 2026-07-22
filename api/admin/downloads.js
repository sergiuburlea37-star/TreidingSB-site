// api/admin/downloads.js
// Returneaza jurnalul complet de descarcari de rapoarte. Accesibil doar
// conturilor din lista de administratori (vezi api/lib/admin.js).

import { getDownloadLog } from '../_lib/store.js';
import { verifySessionToken } from '../_lib/session.js';
import { isAdminEmail } from '../_lib/admin.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const email = verifySessionToken(token);

  if (!email || !isAdminEmail(email)) {
        return res.status(403).json({ error: 'Acces interzis' });
  }

  try {
        const downloads = await getDownloadLog(1000);
        return res.status(200).json({ success: true, downloads });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
