// api/auth-me.js
// Returneaza datele contului curent pe baza tokenului Supabase (Authorization:
// Bearer <token>). Folosit de cabinet ca sa randeze mesajul personalizat si sa
// confirme ca sesiunea e inca valida.

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
          return res.status(401).json({ error: 'Sesiune invalida sau expirata' });
    }

  try {
        if (!access.profile) {
                return res.status(401).json({ error: 'Cont inexistent' });
        }

      return res.status(200).json({
              success: true,
              email: access.email,
              memberId: access.profile.member_id,
              lang: access.profile.lang,
              createdAt: access.profile.created_at,
              role: access.profile.role,
              hasActiveSub: access.hasActiveSub
      });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
