// api/lib/require-admin.js
// Helper folosit de toate endpointurile din api/admin/*: verifica tokenul,
// verifica rolul 'admin' din profiles (via RLS, nu doar in cod) si scrie
// direct raspunsul 401/403 daca nu e cazul. Returneaza `null` in acel caz -
// handlerul apelant trebuie doar sa faca `if (!access) return;`.

import { getAccessInfo } from './access.js';

export async function requireAdmin(req, res) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const access = await getAccessInfo(token);
    if (!access.authenticated) {
          res.status(401).json({ error: 'Autentificare necesară' });
          return null;
    }
    if (!access.isAdmin) {
          res.status(403).json({ error: 'Acest cont nu are drepturi de administrator.' });
          return null;
    }
    return access;
}
