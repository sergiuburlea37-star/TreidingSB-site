// api/admin/subscriptions.js
// Administrarea abonamentelor, doar pentru admin.
// GET   -> toti utilizatorii (profil + abonament)
// PATCH -> { userId, status?, expiresAt?, role? } - actualizeaza abonamentul
//          si/sau rolul unui utilizator.
//
// Nota: schimbarea rolului (profiles.role) foloseste clientul cu service role
// (bypass RLS) - schema SQL da userilor autentificati GRANT doar pe coloana
// "lang" din profiles (ca sa nu-si poata schimba singuri rolul), deci un
// admin autentificat normal n-ar putea sa scrie in "role" prin RLS. Verificarea
// de admin a fost deja facuta de requireAdmin() inainte sa ajungem aici.

import { requireAdmin } from '../_lib/require-admin.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

const VALID_STATUS = ['inactive', 'active', 'cancelled', 'past_due'];
const VALID_ROLE = ['free', 'member', 'admin'];

export default async function handler(req, res) {
    const access = await requireAdmin(req, res);
    if (!access) return;

  try {
        if (req.method === 'GET') {
                const { data: profiles, error: pErr } = await access.client
                  .from('profiles')
                  .select('id, email, member_id, role, created_at')
                  .order('created_at', { ascending: false });
                if (pErr) return res.status(500).json({ error: pErr.message });

          const { data: subs, error: sErr } = await access.client
                  .from('subscriptions')
                  .select('user_id, status, expires_at, provider_customer_id');
                if (sErr) return res.status(500).json({ error: sErr.message });

          const subsByUser = {};
                (subs || []).forEach((s) => {
                          subsByUser[s.user_id] = s;
                });

          const users = (profiles || []).map((p) => ({ ...p, subscription: subsByUser[p.id] || null }));
                return res.status(200).json({ success: true, users });
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

      if (req.method === 'PATCH') {
              const { userId, status, expiresAt, role } = body;
              if (!userId) return res.status(400).json({ error: 'ID utilizator lipsa' });

          if (status !== undefined && !VALID_STATUS.includes(status)) {
                    return res.status(400).json({ error: 'Status invalid' });
          }
              if (role !== undefined && !VALID_ROLE.includes(role)) {
                        return res.status(400).json({ error: 'Rol invalid' });
              }

          if (status !== undefined || expiresAt !== undefined) {
                    const patch = { updated_at: new Date().toISOString() };
                    if (status !== undefined) patch.status = status;
                    if (expiresAt !== undefined) patch.expires_at = expiresAt;
                    const { error } = await access.client.from('subscriptions').update(patch).eq('user_id', userId);
                    if (error) return res.status(500).json({ error: error.message });
          }

          if (role !== undefined) {
                    const admin = getSupabaseAdmin();
                    const { error } = await admin
                      .from('profiles')
                      .update({ role, updated_at: new Date().toISOString() })
                      .eq('id', userId);
                    if (error) return res.status(500).json({ error: error.message });
          }

          return res.status(200).json({ success: true });
      }

      res.setHeader('Allow', 'GET, PATCH');
        return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
