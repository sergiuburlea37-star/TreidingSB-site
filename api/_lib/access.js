// api/lib/access.js
// Rezolva, pe baza unui token Supabase (Authorization: Bearer <access_token>),
// cine e utilizatorul, ce rol are (free/member/admin) si daca are un abonament
// activ chiar acum. Clientul returnat (`client`) e legat de tokenul lui, deci
// orice query facut cu el trece prin politicile RLS din Postgres ca userul
// respectiv - nu doar prin verificari in cod.

import { getSupabaseForToken } from './supabase.js';

export async function getAccessInfo(token) {
    if (!token) return { authenticated: false };

  const client = getSupabaseForToken(token);
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData || !userData.user) return { authenticated: false };

  const userId = userData.user.id;
    const email = userData.user.email;

  const { data: profile } = await client
      .from('profiles')
      .select('role, member_id, lang, created_at')
      .eq('id', userId)
      .maybeSingle();

  const isAdmin = !!profile && profile.role === 'admin';

  let hasActiveSub = isAdmin;
    if (!isAdmin) {
          const { data: sub } = await client
            .from('subscriptions')
            .select('status, expires_at')
            .eq('user_id', userId)
            .maybeSingle();
          hasActiveSub = !!(sub && sub.status === 'active' && sub.expires_at && new Date(sub.expires_at).getTime() > Date.now());
    }

  return { authenticated: true, userId, email, profile, isAdmin, hasActiveSub, client };
}
