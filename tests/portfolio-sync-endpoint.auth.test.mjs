// tests/portfolio-sync-endpoint.auth.test.mjs
//
// Teste de integrare pentru autentificarea POST /api/cron/sync-portfolio-prices
// (cerinta 6: protejat cu PORTFOLIO_CRON_SECRET). Acelasi tipar ca
// tests/account-portfolios.auth.test.mjs: script manual (nu node:test),
// foloseste doar `fetch` global, niciun pachet nou.
//
// Rulare manuala:
//   BASE_URL="https://<preview-sau-production>.vercel.app" node tests/portfolio-sync-endpoint.auth.test.mjs
//
// Cazurile "fara secret" / "secret gresit" NU declanseaza niciun apel EODHD
// sau scriere in DB - raspunsul 401 e dat inainte de orice logica de
// business (vezi handler() in api/cron/sync-portfolio-prices.js). Rularea
// REALA cu secretul corect (care ar declansa un apel EODHD real + o
// posibila scriere atomica) e SKIPPED aici in mod deliberat - se face
// STRICT manual, o singura data, ca parte din procesul de verificare
// pre-productie (vezi raportul insotitor), niciodata dintr-un test automat.

const BASE_URL = process.env.BASE_URL || 'https://treidingsb-l7x6myy28-treiding-sb.vercel.app';
const ENDPOINT = BASE_URL.replace(/\/$/, '') + '/api/cron/sync-portfolio-prices';
const REAL_SECRET = process.env.PORTFOLIO_CRON_SECRET || '';

let passed = 0;
let failed = 0;

async function check(name, expectedStatus, { method = 'POST', headers } = {}) {
  const res = await fetch(ENDPOINT, { method, headers: headers || {} });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text.slice(0, 200); }

  const ok = res.status === expectedStatus;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} -> status ${res.status} (asteptat ${expectedStatus})`, body);
  if (ok) passed++; else failed++;
}

async function skip(name, reason) {
  console.log(`[SKIP] ${name} -- ${reason}`);
}

async function main() {
  console.log(`Testing ${ENDPOINT}\n`);

  await check('fara Authorization header -> 401', 401);
  await check('secret gresit -> 401', 401, {
    headers: { Authorization: 'Bearer secret-evident-gresit' }
  });

  if (REAL_SECRET) {
    await check('secret corect, metoda GET -> 405 (endpoint-ul are efecte secundare, doar POST)', 405, {
      method: 'GET',
      headers: { Authorization: `Bearer ${REAL_SECRET}` }
    });
    await skip(
      'secret corect, POST -> 200 (ok/partial/fetch_failed/locked)',
      'declanseaza un apel EODHD real si o posibila scriere atomica - rulare STRICT manuala, vezi procesul de verificare pre-productie'
    );
  } else {
    await skip('secret corect, metoda GET -> 405', 'necesita PORTFOLIO_CRON_SECRET real in mediu (nu il inventam/hardcodam aici)');
    await skip('secret corect, POST -> 200', 'necesita PORTFOLIO_CRON_SECRET real + rulare STRICT manuala, vezi mai sus');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
