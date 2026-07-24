// api/_lib/site-origin.js
// Origine de incredere pentru linkurile publice trimise prin email (in
// special linkul de dezabonare din api/send-email.js).
//
// NICIODATA nu se foloseste un header de cerere (Host, Origin, Referer sau
// oricare altul) pentru a construi acest link - toate sunt controlabile de
// clientul HTTP si pot fi falsificate, ceea ce ar putea genera un link catre
// un domeniu strain, ales de un atacator. Se folosesc EXCLUSIV variabile de
// sistem Vercel, populate de platforma la runtime (nu de continutul cererii
// curente):
//   - VERCEL_ENV: 'production' | 'preview' | 'development'
//   - VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL: hostname
//     fara protocol (asa cum documenteaza Vercel), disponibile la runtime.
//
// Pe Production: se foloseste exclusiv constanta fixa https://treidingsb.com.
// Daca dintr-un motiv neasteptat aceasta nu ar trece validarea (nu ar trebui
// sa se intample niciodata - e o constanta literala), se incearca
// VERCEL_PROJECT_PRODUCTION_URL, dar NUMAI daca hostname-ul rezultat este
// exact treidingsb.com sau www.treidingsb.com.
//
// Pe Preview (si orice mediu care nu e explicit 'production'): se foloseste
// VERCEL_BRANCH_URL daca exista, altfel VERCEL_URL - ambele sunt hostname-uri
// *.vercel.app generate si controlate de infrastructura Vercel, nu de
// request. treidingsb.com NU este niciodata folosit in afara de Production.
//
// Daca nu se poate determina si valida o origine de incredere, functiile de
// mai jos returneaza null - apelantul (api/send-email.js) TREBUIE sa opreasca
// trimiterea in acest caz, nu sa foloseasca un fallback nesigur si nici sa
// trimita emailul cu un link gresit sau lipsa.

const PRODUCTION_HOSTNAMES = new Set(['treidingsb.com', 'www.treidingsb.com']);

function isValidOrigin(originStr, { isProduction }) {
  let url;
  try {
    url = new URL(originStr);
  } catch (e) {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (!url.hostname) return false;
  return isProduction ? PRODUCTION_HOSTNAMES.has(url.hostname) : true;
}

// Returneaza originea de incredere (ex: "https://treidingsb.com" sau
// "https://my-site-git-branch.vercel.app") sau null daca nu poate fi
// determinata/validata in siguranta. Nu accepta niciun parametru din afara -
// citeste doar din process.env (variabile de sistem, nu de la client).
export function getTrustedOrigin() {
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (isProduction) {
    const fixedOrigin = 'https://treidingsb.com';
    if (isValidOrigin(fixedOrigin, { isProduction: true })) return fixedOrigin;

    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const prodOrigin = prodHost ? `https://${prodHost}` : null;
    if (prodOrigin && isValidOrigin(prodOrigin, { isProduction: true })) return prodOrigin;

    return null;
  }

  // Preview (sau orice alt mediu care nu e explicit 'production' - tratat tot
  // ca ne-Production, deci treidingsb.com nu e folosit niciodata aici).
  const branchHost = process.env.VERCEL_BRANCH_URL;
  const deploymentHost = process.env.VERCEL_URL;
  const candidateHost = branchHost || deploymentHost;
  const candidateOrigin = candidateHost ? `https://${candidateHost}` : null;

  if (candidateOrigin && isValidOrigin(candidateOrigin, { isProduction: false })) {
    return candidateOrigin;
  }
  return null;
}

// Construieste URL-ul complet si sigur de dezabonare (origine de incredere +
// cale fixa + token), folosind obiectul URL / URLSearchParams - nu
// concatenare de string - astfel incat tokenul sa fie mereu encodat corect
// (echivalentul encodeURIComponent) si sa nu poata altera restul URL-ului.
// Returneaza null daca nu exista o origine de incredere valida - apelantul NU
// trebuie sa trimita niciun link de dezabonare in acest caz.
export function buildTrustedUnsubscribeUrl(rawToken) {
  const origin = getTrustedOrigin();
  if (!origin) return null;

  const url = new URL('/unsubscribe.html', origin);
  url.searchParams.set('token', rawToken);
  return url.toString();
}
