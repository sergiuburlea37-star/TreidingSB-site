// api/auth-me.js
// Returneaza datele contului curent pe baza tokenului de sesiune (Authorization: Bearer <token>).
// Folosit de cabinet ca sa randeze mesajul personalizat (Member ID, data
// inscrierii etc) si sa confirme ca sesiunea e inca valida.

import { getUser } from './_lib/store.js';
import { verifySessionToken } from './_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const email = verifySessionToken(token);

  if (!email) {
    return res.status(401).json({ error: 'Sesiune invalidă sau expirată' });
  }

  try {
    const user = await getUser(email);
    if (!user) {
      return res.status(401).json({ error: 'Cont inexistent' });
    }

    return res.status(200).json({
      success: true,
      email: user.email,
      memberId: user.memberId,
      lang: user.lang,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
