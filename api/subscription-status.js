// api/subscription-status.js
// Endpoint mic, dedicat: clientul intreaba "am acces?" fara sa incerce sa
// descarce ceva. Folosit de cabinet ca sa afiseze mesajul + butonul catre
// abonare inainte ca userul sa apese pe idei/raport si sa primeasca un 403.

import { getAccessInfo } from './_lib/access.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const access = await getAccessInfo(token);
    if (!access.authenticated) {
          return res.status(401).json({ error: 'Autentificare necesară' });
    }

  return res.status(200).json({
        success: true,
        role: access.profile ? access.profile.role : 'free',
        isAdmin: access.isAdmin,
        hasActiveSub: access.hasActiveSub
  });
}
