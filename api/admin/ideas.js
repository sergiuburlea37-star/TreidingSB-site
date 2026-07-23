// api/admin/ideas.js
// CRUD pentru ideile de tranzactionare, doar pentru admin.
// GET    -> toate ideile (inclusiv nepublicate)
// POST   -> creeaza o idee noua
// PATCH  -> { id, ...campuri de modificat }
// DELETE -> ?id=... sau { id } in body

import { requireAdmin } from '../_lib/require-admin.js';

export default async function handler(req, res) {
    const access = await requireAdmin(req, res);
    if (!access) return;

  try {
        if (req.method === 'GET') {
                const { data, error } = await access.client
                  .from('trading_ideas')
                  .select('*')
                  .order('created_at', { ascending: false });
                if (error) return res.status(500).json({ error: error.message });
                return res.status(200).json({ success: true, ideas: data || [] });
        }

      let body = req.body;
        if (typeof body === 'string') {
                try {
                          body = JSON.parse(body);
                } catch (e) {
                          return res.status(400).json({ error: 'Invalid request body' });
                }
        }
        body = body || {};

      if (req.method === 'POST') {
              const { ticker, side, entry, stop_loss, take_profit, risk_text, note, published } = body;
              if (!ticker || !side || !entry || !stop_loss || !take_profit) {
                        return res.status(400).json({ error: 'Campuri obligatorii lipsa (ticker, side, entry, stop_loss, take_profit)' });
              }
              if (side !== 'BUY' && side !== 'SELL') {
                        return res.status(400).json({ error: 'side trebuie sa fie BUY sau SELL' });
              }
              const { data, error } = await access.client
                .from('trading_ideas')
                .insert({
                            ticker,
                            side,
                            entry,
                            stop_loss,
                            take_profit,
                            risk_text: risk_text || null,
                            note: note || null,
                            published: !!published
                })
                .select()
                .single();
              if (error) return res.status(500).json({ error: error.message });
              return res.status(200).json({ success: true, idea: data });
      }

      if (req.method === 'PATCH') {
              const { id, ...patch } = body;
              if (!id) return res.status(400).json({ error: 'ID lipsa' });
              patch.updated_at = new Date().toISOString();
              const { data, error } = await access.client
                .from('trading_ideas')
                .update(patch)
                .eq('id', id)
                .select()
                .single();
              if (error) return res.status(500).json({ error: error.message });
              return res.status(200).json({ success: true, idea: data });
      }

      if (req.method === 'DELETE') {
              const id = typeof req.query.id === 'string' ? req.query.id : body.id;
              if (!id) return res.status(400).json({ error: 'ID lipsa' });
              const { error } = await access.client.from('trading_ideas').delete().eq('id', id);
              if (error) return res.status(500).json({ error: error.message });
              return res.status(200).json({ success: true });
      }

      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
