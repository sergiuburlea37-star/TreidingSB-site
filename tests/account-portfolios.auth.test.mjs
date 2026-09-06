// tests/account-portfolios.auth.test.mjs
//
// Teste de integrare pentru autorizarea GET /api/account-portfolios.
// Nu necesita niciun pachet nou (foloseste doar `fetch` global din Node 18+).
//
// Rulare manuala:
//   BASE_URL="https://<preview-sau-production>.vercel.app" node tests/account-portfolios.auth.test.mjs
//
// Daca deploy-ul tintit are Vercel Deployment Protection activa (SSO), setati
// si VERCEL_PROTECTION_BYPASS (secretul de "Protection Bypass for Automation"
// din Vercel), altfel orice request primeste pagina HTML de login (status 200)
// in loc de raspunsul JSON real al aplicatiei, iar testele de mai jos pica
// fara sa fi atins vreodata codul de autentificare propriu-zis.
//
// Cele 3 teste de mai jos (fara token / token malformat / token sintactic
// valid dar cu semnatura invalida - echivalentul practic al unui token expirat
// sau falsificat) NU ating baza de date si pot rula oricand, inclusiv acum,
// inainte ca migrarea supabase/migrations/202607290001_member_portfolios.sql
// sa fie aplicata - raspunsul 401 e dat de stratul de autentificare, inainte
// de orice query catre tabelele noi.
//
// Celelalte 4 cazuri cerute (free -> 403, abonament expirat -> 403, membru
// activ -> 200 read-only, admin -> 200) NU pot rula fara migrarea aplicata
// SI fara conturi de test reale (cu profiles.role si subscriptions.status
// cunoscute dinainte). Sunt incluse mai jos ca teste explicit SKIPPED, cu
// exact ce e nevoie ca sa devina rulabile - vezi REQUIRED_ENV_FOR_DB_TESTS.
// Nu inventam si nu simulam un rezultat pentru ele.

const BASE_URL = process.env.BASE_URL || 'https://treidingsb-l7x6myy28-treiding-sb.vercel.app';
const ENDPOINT = BASE_URL.replace(/\/$/, '') + '/api/account-portfolios';

// Token sintactic valid (3 parti separate prin '.', fiecare base64url), dar
// cu semnatura care nu poate fi valida - Supabase Auth trebuie sa il resping
// pe server (verificare de semnatura), fara sa arunce local la parsare.
// Acopera practic acelasi cod ca un token expirat: JWT bine format, dar
// respins de backend-ul de autentificare.
const SIGNATURE_INVALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNzAwMDAwMDAwfQ.' +
  'not_a_real_signature_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let passed = 0;
let failed = 0;

const BYPASS_HEADERS = process.env.VERCEL_PROTECTION_BYPASS
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_PROTECTION_BYPASS }
  : {};

async function check(name, { headers } = {}) {
  const res = await fetch(ENDPOINT, { method: 'GET', headers: { ...BYPASS_HEADERS, ...headers } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text.slice(0, 200); }

  const ok = res.status === 401;
  const leaksInternals = typeof body === 'object' && body !== null
    ? JSON.stringify(body).match(/jwt|supabase|stack|at Object|FUNCTION_INVOCATION/i)
    : String(body).match(/jwt|supabase|stack|at Object|FUNCTION_INVOCATION/i);

  console.log(`[${ok && !leaksInternals ? 'PASS' : 'FAIL'}] ${name} -> status ${res.status}`, body);
  if (ok && !leaksInternals) passed++; else failed++;
}

async function skip(name, reason) {
  console.log(`[SKIP] ${name} -- ${reason}`);
}

async function main() {
  console.log(`Testing ${ENDPOINT}\n`);

  await check('fara token', {});
  await check('token malformat (string arbitrar)', {
    headers: { Authorization: 'Bearer invalid.garbage.token' }
  });
  await check('token sintactic valid, semnatura invalida (echivalent expirat/falsificat)', {
    headers: { Authorization: `Bearer ${SIGNATURE_INVALID_JWT}` }
  });

  console.log('');
  const REQUIRED_ENV_FOR_DB_TESTS = [
    'TEST_FREE_USER_TOKEN      - cont real cu profiles.role=\'free\', fara subscriptions activ',
    'TEST_EXPIRED_SUB_TOKEN    - cont real cu subscriptions.status=\'active\' dar expires_at in trecut',
    'TEST_ACTIVE_MEMBER_TOKEN  - cont real cu subscriptions.status=\'active\' si expires_at in viitor',
    'TEST_ADMIN_TOKEN          - cont real cu profiles.role=\'admin\''
  ];
  await skip('free -> 403', 'necesita migrarea aplicata + ' + REQUIRED_ENV_FOR_DB_TESTS[0]);
  await skip('abonament expirat -> 403', 'necesita migrarea aplicata + ' + REQUIRED_ENV_FOR_DB_TESTS[1]);
  await skip('membru activ -> 200, read-only', 'necesita migrarea aplicata + ' + REQUIRED_ENV_FOR_DB_TESTS[2]);
  await skip('admin -> 200', 'necesita migrarea aplicata + ' + REQUIRED_ENV_FOR_DB_TESTS[3]);

  console.log(`\n${passed} passed, ${failed} failed, 4 skipped (necesita migrare + conturi de test)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
