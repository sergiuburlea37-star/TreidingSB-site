// api/account-ideas.js
// Returneaza ideile de tranzactionare pentru membrii autentificati prin cont
// real (email/parola), pe baza tokenului de sesiune (Authorization: Bearer <token>).
// Folosit de Cabinetul personal - spre deosebire de api/ideas.js (sistemul
// vechi cu parola comuna), aici fiecare client vede ideile doar daca are o
// sesiune valida legata de contul lui.

import { getUser } from './lib/store.js';
import { verifySessionToken } from './lib/session.js';

// Continutul real al ideilor de tranzactionare traieste doar aici, pe server.
const IDEAS = [
  {
        ticker: "XAU/USD",
        side: "SELL",
        entry: "4040–4050",
        sl: "4097",
        tp: "4000 / 3975",
        riskKey: "ideas.card1.riskValue",
        noteKey: "ideas.card1.note"
  },
  {
        ticker: "EUR/USD",
        side: "BUY",
        entry: "1.0870",
        sl: "1.0820",
        tp: "1.0950",
        riskKey: "ideas.card2.riskValue",
        noteKey: "ideas.card2.note"
  }
  ];

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const email = verifySessionToken(token);

  if (!email) {
        return res.status(401).json({ error: 'Sesiune invalida sau expirata' });
  }

  try {
        const user = await getUser(email);
        if (!user) {
                return res.status(401).json({ error: 'Cont inexistent' });
        }

      return res.status(200).json({ success: true, ideas: IDEAS });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
