// tests/portfolio-math.test.mjs
//
// Teste pure pentru api/_lib/portfolio-math.js - cash din ledger (cerinta 9),
// NAV (cerinta 11, verificat implicit: holdingsValueBaseCcy + ledgerCash se
// compun in api/account-portfolios.js, nu aici), capital net contribuit
// (cerinta 12) si steagul de randament "pending" (cerinta 13). Fara
// Supabase/HTTP - convert/convertAsOf sunt mock-uri simple injectate.
//
// Rulare: node --test tests/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLedgerCashBaseCcy,
  computeNetCapitalContributedBaseCcy,
  hasPostFoundingCashFlow
} from '../api/_lib/portfolio-math.js';

const PORTFOLIO_A = 'portfolio-a';
const PORTFOLIO_B = 'portfolio-b';

// convert() simplu: identitate pt. aceeasi moneda, USD->GBP la 0.79 fix,
// null pt. orice alta pereche (simuleaza "curs indisponibil").
function mockConvert(amount, from, to) {
  if (from === to) return amount;
  if (from === 'USD' && to === 'GBP') return amount * 0.79;
  return null;
}

// convertAsOf() cu doua cursuri istorice cunoscute, pe date diferite -
// verifica ca fiecare tranzactie foloseste cursul PROPRIEI date.
function mockConvertAsOf(amount, from, to, targetDate) {
  if (from === to) return amount;
  if (from === 'USD' && to === 'GBP') {
    if (targetDate === '2026-05-07') return amount * 0.80;
    if (targetDate === '2026-05-20') return amount * 0.75;
  }
  return null;
}

describe('computeLedgerCashBaseCcy', () => {
  test('BUY/DEPOSIT/dividend 0 sau negativ marcheaza ledgerul incomplet si nu inverseaza cash-ul', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'BUY', amount: -100, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'FEE', amount: 0, currency: 'GBP' }
    ];
    const dividends = [{ portfolio_id: PORTFOLIO_A, amount: -5, currency: 'GBP' }];
    const result = computeLedgerCashBaseCcy(transactions, dividends, PORTFOLIO_A, 'GBP', mockConvert);
    assert.equal(result.value, 1000);
    assert.equal(result.complete, false);
  });
  test('DEPOSIT + SELL + dividende - BUY - WITHDRAWAL - FEE, toate in moneda de baza', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 10000, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'BUY', amount: 6700, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'SELL', amount: 500, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'WITHDRAWAL', amount: 200, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'FEE', amount: 10, currency: 'GBP' }
    ];
    const dividends = [{ portfolio_id: PORTFOLIO_A, amount: 50, currency: 'GBP' }];

    const result = computeLedgerCashBaseCcy(transactions, dividends, PORTFOLIO_A, 'GBP', mockConvert);
    // 10000 + 500 + 50 - 6700 - 200 - 10 = 3640
    assert.equal(result.value, 3640);
    assert.equal(result.complete, true);
  });

  test('converteste tranzactii in alta moneda folosind convert()', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'USD' } // *0.79 = 790
    ];
    const result = computeLedgerCashBaseCcy(transactions, [], PORTFOLIO_A, 'GBP', mockConvert);
    assert.equal(result.value, 790);
    assert.equal(result.complete, true);
  });

  test('curs lipsa -> complete=false, suma exclude randul neconvertibil (nu il trateaza ca 0 silentios)', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 500, currency: 'CHF' } // fara curs mock CHF->GBP
    ];
    const result = computeLedgerCashBaseCcy(transactions, [], PORTFOLIO_A, 'GBP', mockConvert);
    assert.equal(result.value, 1000); // doar randul convertibil
    assert.equal(result.complete, false);
  });

  test('filtreaza strict dupa portfolio_id - nu amesteca ledger-ul altui portofoliu', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP' },
      { portfolio_id: PORTFOLIO_B, type: 'DEPOSIT', amount: 99999, currency: 'GBP' }
    ];
    const result = computeLedgerCashBaseCcy(transactions, [], PORTFOLIO_A, 'GBP', mockConvert);
    assert.equal(result.value, 1000);
  });

  test('portofoliu fara nicio tranzactie/dividend -> 0, complete', () => {
    const result = computeLedgerCashBaseCcy([], [], PORTFOLIO_A, 'GBP', mockConvert);
    assert.equal(result.value, 0);
    assert.equal(result.complete, true);
  });
});

describe('computeNetCapitalContributedBaseCcy', () => {
  test('DEPOSIT/WITHDRAWAL negativ nu inverseaza semantica si marcheaza incomplet', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP', executed_at: '2026-05-07T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'WITHDRAWAL', amount: -200, currency: 'GBP', executed_at: '2026-05-20T00:00:00Z' }
    ];
    const result = computeNetCapitalContributedBaseCcy(transactions, PORTFOLIO_A, 'GBP', mockConvertAsOf);
    assert.equal(result.value, 1000);
    assert.equal(result.complete, false);
  });
  test('DEPOSIT - WITHDRAWAL, fiecare la cursul PROPRIEI date de executie', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'USD', executed_at: '2026-05-07T00:00:00Z' }, // *0.80
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'USD', executed_at: '2026-05-20T00:00:00Z' }  // *0.75
    ];
    const result = computeNetCapitalContributedBaseCcy(transactions, PORTFOLIO_A, 'GBP', mockConvertAsOf);
    assert.equal(result.value, 800 + 750);
    assert.equal(result.complete, true);
  });

  test('WITHDRAWAL scade din capitalul net contribuit', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP', executed_at: '2026-05-07T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'WITHDRAWAL', amount: 200, currency: 'GBP', executed_at: '2026-05-20T00:00:00Z' }
    ];
    const result = computeNetCapitalContributedBaseCcy(transactions, PORTFOLIO_A, 'GBP', mockConvertAsOf);
    assert.equal(result.value, 800);
  });

  test('BUY/SELL/FEE nu sunt capital contribuit - ignorate complet', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'GBP', executed_at: '2026-05-07T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'BUY', amount: 500, currency: 'GBP', executed_at: '2026-05-08T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'SELL', amount: 100, currency: 'GBP', executed_at: '2026-05-09T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'FEE', amount: 5, currency: 'GBP', executed_at: '2026-05-10T00:00:00Z' }
    ];
    const result = computeNetCapitalContributedBaseCcy(transactions, PORTFOLIO_A, 'GBP', mockConvertAsOf);
    assert.equal(result.value, 1000);
  });

  test('curs istoric lipsa pt. data tranzactiei -> complete=false', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', amount: 1000, currency: 'USD', executed_at: '2026-01-01T00:00:00Z' } // fara curs mock la aceasta data
    ];
    const result = computeNetCapitalContributedBaseCcy(transactions, PORTFOLIO_A, 'GBP', mockConvertAsOf);
    assert.equal(result.complete, false);
  });
});

describe('hasPostFoundingCashFlow', () => {
  test('fara founded_date -> false (defensiv, nu presupune nimic)', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'WITHDRAWAL', executed_at: '2026-06-01T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, null), false);
  });

  test('doar depozitul de fondare (aceeasi data ca founded_date) -> false', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', executed_at: '2026-05-07T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, '2026-05-07'), false);
  });

  test('un DEPOSIT ulterior fondarii -> true (randamentul devine "pending")', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', executed_at: '2026-05-07T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'DEPOSIT', executed_at: '2026-07-01T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, '2026-05-07'), true);
  });

  test('un WITHDRAWAL ulterior fondarii -> true', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'WITHDRAWAL', executed_at: '2026-08-01T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, '2026-05-07'), true);
  });

  test('BUY/SELL/FEE ulterioare fondarii nu conteaza (nu sunt cash flow de capital)', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_A, type: 'BUY', executed_at: '2026-07-01T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'SELL', executed_at: '2026-07-02T00:00:00Z' },
      { portfolio_id: PORTFOLIO_A, type: 'FEE', executed_at: '2026-07-03T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, '2026-05-07'), false);
  });

  test('filtreaza strict dupa portfolio_id', () => {
    const transactions = [
      { portfolio_id: PORTFOLIO_B, type: 'WITHDRAWAL', executed_at: '2026-08-01T00:00:00Z' }
    ];
    assert.equal(hasPostFoundingCashFlow(transactions, PORTFOLIO_A, '2026-05-07'), false);
  });
});
