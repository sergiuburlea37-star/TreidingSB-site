// api/account-ideas.js
// Returneaza ideile de tranzactionare publicate, doar pentru membri cu
// abonament activ (sau admin). Ideile nu mai sunt hardcodate in acest fisier
// - traiesc in tabela public.trading_ideas (Supabase), editabile din panoul
// de administrare (api/admin/ideas.js).

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
    if (!access.isAdmin && !access.hasActiveSub) {
          return res.status(403).json({ error: 'Necesita abonament activ', requiresSubscription: true });
    }

  try {
        const { data, error } = await access.client
          .from('trading_ideas')
          .select('ticker, side, entry, stop_loss, take_profit, risk_text, note')
          .eq('published', true)
          .order('created_at', { ascending: false });

      if (error) {
              return res.status(500).json({ error: 'Server error: ' + error.message });
      }

      const ideas = (data || []).map((i) => ({
              ticker: i.ticker,
              side: i.side,
              entry: i.entry,
              sl: i.stop_loss,
              tp: i.take_profit,
              risk: i.risk_text || '',
              note: i.note || ''
      }));

      return res.status(200).json({ success: true, ideas });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
