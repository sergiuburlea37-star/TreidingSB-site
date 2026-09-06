// api/_lib/portfolio-math.js
//
// Formule financiare pure pentru portofolii (cash din ledger, NAV, capital
// net contribuit, randament "pending") - extrase intr-un modul separat,
// fara Supabase/HTTP, testabil izolat (ca api/_lib/fx-convert.js). Folosit
// atat de api/account-portfolios.js (citire, pentru membri) cat si de
// api/cron/sync-portfolio-prices.js (scriere, pentru randurile de
// portfolio_performance_history trimise catre RPC-ul atomic) - o singura
// sursa de adevar pentru aceste formule, ca sa nu diverga intre cele doua
// locuri (aceeasi motivatie ca extragerea convert()/convertAsOf()).
//
// Toate functiile primesc `convert`/`convertAsOf` din createFxConverter()
// (api/_lib/fx-convert.js) - NU reimplementeaza conversia valutara.
// Returneaza intotdeauna { value, complete }: `complete` e false daca cel
// putin o suma nu a putut fi convertita (curs lipsa) - apelantul decide
// atunci daca expune valoarea partiala sau null, la fel ca restul
// codebase-ului (vezi dataComplete/totalWithKnownValue in account-portfolios.js).
//
// Nota deliberata: formula de cash de mai jos foloseste coloana `amount` a
// fiecarei tranzactii, exact cum a fost specificata ("DEPOSIT + SELL +
// dividende - BUY - WITHDRAWAL - FEE"). NU aduna separat `fee_amount` de pe
// randurile BUY/SELL (o eventuala taxa inclusa acolo) - schema permite acest
// camp, dar cerinta nu il mentioneaza si adaugarea lui ar fi o presupunere
// neceruta. De revizuit separat, cu aprobare explicita, daca fee_amount pe
// BUY/SELL ajunge sa fie populat cu valori nenule in date reale.

function sumSigned(rows, amountOf, currencyOf, convertFn, sign) {
  let sum = 0;
  let complete = true;
  for (const row of rows) {
    const amount = Number(amountOf(row));
    if (!Number.isFinite(amount) || amount <= 0) {
      complete = false;
      continue;
    }
    const converted = convertFn(amount, currencyOf(row));
    if (converted == null) {
      complete = false;
      continue;
    }
    sum += sign(row) * converted;
  }
  return { sum, complete };
}

// Cerinta 9: DEPOSIT + SELL + dividende - BUY - WITHDRAWAL - FEE, per
// portofoliu, convertite in moneda de baza cu convert() (semantica "valoare
// curenta" - nu exista o data de tranzactie de respectat pt. cash-ul de
// ACUM, spre deosebire de capitalul net contribuit mai jos).
const CASH_TX_TYPES = ['DEPOSIT', 'SELL', 'BUY', 'WITHDRAWAL', 'FEE'];

export function computeLedgerCashBaseCcy(transactions, dividends, portfolioId, baseCurrency, convert) {
  // Schema restrictioneaza deja `type` prin CHECK la aceste 5 valori, dar
  // filtrul ramane explicit (defensiv, si ca documentatie a formulei).
  const txs = (transactions || []).filter((t) => t.portfolio_id === portfolioId && CASH_TX_TYPES.includes(t.type));
  const divs = (dividends || []).filter((d) => d.portfolio_id === portfolioId);

  const convertFn = (amount, currency) => convert(amount, currency, baseCurrency);

  const txResult = sumSigned(
    txs,
    (t) => t.amount,
    (t) => t.currency,
    convertFn,
    (t) => (t.type === 'DEPOSIT' || t.type === 'SELL' ? 1 : -1) // BUY/WITHDRAWAL/FEE -> -1
  );
  const divResult = sumSigned(divs, (d) => d.amount, (d) => d.currency, convertFn, () => 1);

  return {
    value: txResult.sum + divResult.sum,
    complete: txResult.complete && divResult.complete
  };
}

// Cerinta 12: capital net contribuit = DEPOSIT - WITHDRAWAL, fiecare
// convertita cu convertAsOf() la PROPRIA data de executie (executed_at) -
// consecvent cu conventia deja existenta pentru initialWeightPct (nu
// foloseste "cel mai recent curs", care ar putea fi ulterior tranzactiei).
export function computeNetCapitalContributedBaseCcy(transactions, portfolioId, baseCurrency, convertAsOf) {
  const txs = (transactions || []).filter(
    (t) => t.portfolio_id === portfolioId && (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
  );

  let sum = 0;
  let complete = true;
  for (const t of txs) {
    const targetDate = (t.executed_at || '').slice(0, 10);
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      complete = false;
      continue;
    }
    const converted = convertAsOf(amount, t.currency, baseCurrency, targetDate);
    if (converted == null) {
      complete = false;
      continue;
    }
    sum += (t.type === 'DEPOSIT' ? 1 : -1) * converted;
  }
  return { value: sum, complete };
}

// Cerinta 13: true daca a existat vreun DEPOSIT/WITHDRAWAL executat DUPA
// founded_date (strict) - depozitul initial de fondare e datat chiar la
// founded_date (vezi seed-ul portofoliilor), deci comparatia stricta '>' il
// exclude automat, fara sa fie nevoie sa fie identificat separat.
export function hasPostFoundingCashFlow(transactions, portfolioId, foundedDate) {
  if (!foundedDate) return false;
  return (transactions || []).some((t) => {
    if (t.portfolio_id !== portfolioId) return false;
    if (t.type !== 'DEPOSIT' && t.type !== 'WITHDRAWAL') return false;
    const txDate = (t.executed_at || '').slice(0, 10);
    return txDate > foundedDate;
  });
}
