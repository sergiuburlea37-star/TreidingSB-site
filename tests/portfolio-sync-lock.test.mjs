// Integrare optionala cu un proiect Supabase de TEST. Verifica lease-ul care
// precede orice read/fetch; nu scrie preturi si nu aplica migrari.

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.log('[SKIP] test lease concurenta -- lipsesc SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  if (process.env.ALLOW_SUPABASE_WRITE_TESTS !== '1') {
    console.log('[SKIP] test lease concurenta -- necesita ALLOW_SUPABASE_WRITE_TESTS=1 pe proiect TEST');
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const owners = [randomUUID(), randomUUID()];
  const calls = owners.map((owner) => admin.rpc('acquire_portfolio_sync_lease', { p_owner: owner, p_ttl_seconds: 60 }));
  const results = await Promise.all(calls);
  const errors = results.filter((result) => result.error);
  const winners = results.map((result, index) => ({ owner: owners[index], acquired: result.data && result.data.acquired === true }))
    .filter((result) => result.acquired);

  if (errors.length || winners.length !== 1) {
    console.error('[FAIL] exact un run trebuie sa obtina lease', { errors, results: results.map((r) => r.data) });
    process.exit(1);
  }
  const loser = owners.find((owner) => owner !== winners[0].owner);
  const wrongRelease = await admin.rpc('release_portfolio_sync_lease', { p_owner: loser });
  if (wrongRelease.error || wrongRelease.data !== false) throw new Error('non-owner release a fost acceptat');

  const expired = await admin.from('portfolio_sync_lease').update({
    acquired_at: new Date(Date.now() - 120000).toISOString(),
    expires_at: new Date(Date.now() - 60000).toISOString()
  }).eq('lease_name', 'portfolio_price_sync').eq('owner', winners[0].owner);
  if (expired.error) throw expired.error;
  const takeover = await admin.rpc('acquire_portfolio_sync_lease', { p_owner: loser, p_ttl_seconds: 60 });
  if (takeover.error || !takeover.data?.acquired) throw new Error('TTL takeover a esuat');
  await admin.rpc('release_portfolio_sync_lease', { p_owner: loser });
  console.log('[PASS] concurenta, owner-mismatch release si TTL takeover');
}

main().catch((error) => {
  console.error('[FAIL] test lease:', error);
  process.exit(1);
});
