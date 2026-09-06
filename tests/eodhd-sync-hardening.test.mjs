import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  acquireSyncLease,
  releaseSyncLease,
  buildEvaluationBasis,
  buildProviderRequestPlan,
  createSyncHandler,
  evaluateQuotaPreflight,
  logSyncRun,
  validateLedgerRows,
  validatePerformanceRowsContract,
  validatePortfolioUniverse
} from '../api/cron/sync-portfolio-prices.js';
import { createFxConverter } from '../api/_lib/fx-convert.js';
import { hasMarketSessionPolicy, normalizeProviderSymbol, SUPPORTED_MARKET_SUFFIXES } from '../api/_lib/eodhd.js';
import { isSyncPublicationIssue } from '../api/account-portfolios.js';
import {
  handleCrudTable,
  normalizePortfolioPositionBody,
  PORTFOLIO_POSITION_CRUD_OPTIONS,
  validatePortfolioDividendState,
  validatePortfolioPerformanceState,
  validatePortfolioPositionState,
  validatePortfolioTransactionState
} from '../api/admin/[name].js';

function assertCrudNormalizationWiring(source) {
  const handlerIndex = source.indexOf('export async function handleCrudTable');
  assert.ok(handlerIndex >= 0, 'handleCrudTable lipseste');
  const crudSource = source.slice(handlerIndex);
  const normalizeIndex = crudSource.indexOf('if (opts.normalize) body = opts.normalize(body);');
  const postIndex = crudSource.indexOf("if (req.method === 'POST')");
  const patchIndex = crudSource.indexOf("if (req.method === 'PATCH')");
  assert.ok(normalizeIndex >= 0, 'apelul opts.normalize lipseste');
  assert.ok(postIndex >= 0, 'ramura POST lipseste');
  assert.ok(patchIndex >= 0, 'ramura PATCH lipseste');
  assert.ok(normalizeIndex < postIndex, 'normalizarea trebuie sa preceada POST');
  assert.ok(normalizeIndex < patchIndex, 'normalizarea trebuie sa preceada PATCH');
  assert.ok(postIndex < patchIndex, 'ordinea ramurilor POST/PATCH s-a schimbat neasteptat');
}

const portfolios = [
  { id: 'us-id', code: 'US', base_currency: 'GBP' },
  { id: 'eu-id', code: 'EU', base_currency: 'EUR' }
];

function validPosition(overrides = {}) {
  return {
    id: 'position-id', portfolio_id: 'us-id', ticker: 'AAPL',
    instrument_currency: 'USD', quantity: 2, avg_price: 100,
    current_price: 110, price_updated_at: '2026-08-14T20:00:00Z', price_source: 'delayed_feed',
    provider_symbol: 'AAPL.US', provider_price_multiplier: 1,
    ...overrides
  };
}

function queryResult(result, extras = {}) {
  const query = {
    select() { return this; }, in() { return this; }, eq() { return this; },
    order() { return this; }, gte() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    ...extras
  };
  return query;
}

function responseRecorder() {
  return {
    statusCode: 0, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {}
  };
}

async function withCronSecret(run) {
  const previous = process.env.PORTFOLIO_CRON_SECRET;
  process.env.PORTFOLIO_CRON_SECRET = 'test-secret';
  try { return await run(); } finally {
    if (previous === undefined) delete process.env.PORTFOLIO_CRON_SECRET;
    else process.env.PORTFOLIO_CRON_SECRET = previous;
  }
}

describe('request plan si quota EODHD', () => {
  test('deduplica AAPL detinut in ambele portofolii si perechile FX', () => {
    const plan = buildProviderRequestPlan(portfolios, [
      validPosition(),
      validPosition({ id: 'eu-aapl', portfolio_id: 'eu-id' })
    ], [
      { portfolio_id: 'us-id', currency: 'USD' },
      { portfolio_id: 'us-id', currency: 'USD' }
    ], []);
    assert.deepEqual(plan.symbols, ['AAPL.US']);
    assert.deepEqual(plan.fxPairs, [{ base: 'USD', quote: 'GBP' }, { base: 'USD', quote: 'EUR' }]);
    assert.equal(plan.providerCallUnits, 3);
  });

  test('preflight este fail-closed fara limita si opreste depasirea cotei', () => {
    assert.equal(evaluateQuotaPreflight({ dailyLimit: '', usedToday: 0, requestedUnits: 23 }).reason, 'quota_unconfigured');
    assert.equal(evaluateQuotaPreflight({ dailyLimit: 100, usedToday: 80, requestedUnits: 21 }).reason, 'quota_exhausted');
    assert.equal(evaluateQuotaPreflight({ dailyLimit: 100, usedToday: 70, requestedUnits: 20 }).warning, true);
  });
});

describe('fail-closed pe univers, quantity, multiplier si performance rows', () => {
  const euPosition = validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', provider_symbol: 'SAP.XETRA' });

  test('quantity lipsa este problema, nu devine 0', () => {
    const problems = validatePortfolioUniverse(portfolios, [validPosition({ quantity: undefined }), euPosition]);
    assert.ok(problems.some((problem) => problem.status === 'missing_quantity'));
  });

  test('ledger amount 0/negativ/NaN/overflow este respins inainte de fetch', () => {
    for (const amount of [0, -100, NaN, Infinity]) {
      assert.ok(validateLedgerRows([{ type: 'BUY', amount, portfolio_id: 'us-id' }], [])
        .some((problem) => problem.status === 'invalid_transaction_amount'));
      assert.ok(validateLedgerRows([], [{ amount, portfolio_id: 'eu-id' }])
        .some((problem) => problem.status === 'invalid_dividend_amount'));
    }
  });

  test('evaluation fingerprint acopera positions complete si FX update/insert/delete', () => {
    const tx = [{ id: 'tx-1', portfolio_id: 'us-id', type: 'DEPOSIT', amount: 100, currency: 'GBP', executed_at: '2026-08-14T10:00:00Z' }];
    const divs = [{ id: 'div-1', portfolio_id: 'eu-id', amount: 2, currency: 'EUR' }];
    const positions = [validPosition(), validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', provider_symbol: 'SAP.XETRA' })];
    const fx = [{
      id: 'fx-1', base_currency: 'USD', quote_currency: 'GBP', rate: 0.75,
      as_of_date: '2026-08-14', source: 'manual', provider_fetched_at: null
    }];
    const basis = buildEvaluationBasis(portfolios, positions, tx, divs, fx);
    assert.deepEqual(basis, buildEvaluationBasis([...portfolios].reverse(), [...positions].reverse(), tx, divs, fx));
    for (const change of [
      { quantity: 3 }, { instrument_currency: 'EUR' },
      { provider_price_multiplier: 0.01 }, { provider_symbol: 'MSFT.US' },
      { portfolio_id: 'eu-id' }, { avg_price: 99 }, { current_price: 111 },
      { price_updated_at: '2026-08-14T20:01:00Z' }, { price_source: 'manual' }
    ]) {
      const changed = buildEvaluationBasis(portfolios, [{ ...positions[0], ...change }, positions[1]], tx, divs, fx);
      assert.notDeepEqual(changed, basis);
    }
    assert.notDeepEqual(buildEvaluationBasis(portfolios, positions, tx, divs, [{ ...fx[0], rate: 0.8 }]), basis, 'FX update');
    assert.notDeepEqual(buildEvaluationBasis(portfolios, positions, tx, divs, [...fx, { ...fx[0], id: 'fx-2', as_of_date: '2026-08-13' }]), basis, 'FX insert phantom');
    assert.notDeepEqual(buildEvaluationBasis(portfolios, positions, tx, divs, []), basis, 'FX delete');

    const rpcSql = readFileSync(new URL('../supabase/migrations/202608140004_sync_lock_and_atomic_snapshot_function.sql', import.meta.url), 'utf8');
    assert.match(rpcSql, /lock table public\.portfolios,[\s\S]*public\.portfolio_dividends,[\s\S]*public\.fx_rates in share mode/);
    assert.match(rpcSql, /from public\.portfolio_positions[\s\S]*for update/);
    assert.match(rpcSql, /perform 1 from public\.fx_rates for update/);
    assert.match(rpcSql, /'fx_rates',[\s\S]*from public\.fx_rates f/);
    assert.match(rpcSql, /'current_price', pp\.current_price/);
    assert.match(rpcSql, /price_updated_at <= \(pos->>'provider_timestamp'\)::timestamptz/,
      'timestamp egal trebuie sa actualizeze pretul folosit de performance row');
    assert.match(rpcSql, /if db_basis <> payload->'evaluation_basis'/);
    assert.match(rpcSql, /reason, problems[\s\S]*'state_changed'/);
  });

  test('multiplier 0/negativ/NaN/overflow este respins', () => {
    for (const multiplier of [0, -1, NaN, Infinity]) {
      const problems = validatePortfolioUniverse(portfolios, [validPosition({ provider_price_multiplier: multiplier }), euPosition]);
      assert.ok(problems.some((problem) => problem.status === 'invalid_multiplier'));
    }
  });

  test('avg_price invalid este respins de handlerul real inainte de orice provider fetch', async () => {
    let fetchCount = 0;
    const rows = {
      portfolios: portfolios.map((row) => ({ ...row, initial_capital: 100, founded_date: '2026-08-01' })),
      portfolio_positions: [
        validPosition({ avg_price: 0 }),
        validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', instrument_currency: 'EUR', provider_symbol: 'SAP.XETRA' })
      ],
      portfolio_transactions: [], portfolio_dividends: [], fx_rates: [], portfolio_sync_runs: []
    };
    const audit = [];
    const admin = {
      async rpc(name) {
        if (name === 'acquire_portfolio_sync_lease') return { data: { acquired: true }, error: null };
        if (name === 'release_portfolio_sync_lease') return { data: true, error: null };
        throw new Error(`RPC neasteptat: ${name}`);
      },
      from(table) {
        return queryResult({ data: rows[table], error: null }, {
          async insert(value) { audit.push(value); return { error: null }; }
        });
      }
    };
    const handler = createSyncHandler({
      getAdmin: () => admin,
      fetchPrices: async () => { fetchCount += 1; return []; },
      fetchFxRates: async () => { fetchCount += 1; return []; },
      createRunId: () => '00000000-0000-4000-8000-000000000002'
    });
    const response = responseRecorder();
    await withCronSecret(() => handler({ method: 'POST', headers: { authorization: 'Bearer test-secret' } }, response));
    assert.equal(fetchCount, 0);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.reason, 'partial');
    assert.ok(response.body.problems.some((problem) => problem.status === 'invalid_avg_price'));
    assert.equal(audit[0].provider_call_units, 0);
  });

  test('NAV negativ este partial in handlerul real si nu ajunge la RPC', async () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const positionRows = [
      validPosition({ id: 'us-pos', ticker: 'VUKE', instrument_currency: 'GBP', provider_symbol: 'VUKE.LSE' }),
      validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', instrument_currency: 'EUR', provider_symbol: 'SAP.XETRA' })
    ];
    const rows = {
      portfolios: portfolios.map((row) => ({ ...row, initial_capital: 100, founded_date: '2026-08-01' })),
      portfolio_positions: positionRows,
      portfolio_transactions: [
        { id: 'tx-us', portfolio_id: 'us-id', type: 'WITHDRAWAL', amount: 1000, fee_amount: 0, currency: 'GBP', executed_at: '2026-08-02T10:00:00Z' },
        { id: 'tx-eu', portfolio_id: 'eu-id', type: 'DEPOSIT', amount: 100, fee_amount: 0, currency: 'EUR', executed_at: '2026-08-01T10:00:00Z' }
      ],
      portfolio_dividends: [], fx_rates: [], portfolio_sync_runs: []
    };
    let applyCalled = false;
    const admin = {
      async rpc(name) {
        if (name === 'acquire_portfolio_sync_lease') return { data: { acquired: true }, error: null };
        if (name === 'release_portfolio_sync_lease') return { data: true, error: null };
        if (name === 'apply_portfolio_price_snapshot') applyCalled = true;
        return { data: null, error: null };
      },
      from(table) {
        return queryResult({ data: rows[table], error: null }, { async insert() { return { error: null }; } });
      }
    };
    const handler = createSyncHandler({
      getAdmin: () => admin,
      fetchPrices: async () => positionRows.map((row) => ({ providerSymbol: row.provider_symbol, price: 10, providerTimestamp: '2026-08-10T11:50:00Z' })),
      fetchFxRates: async () => [],
      createRunId: () => '00000000-0000-4000-8000-000000000004',
      clock: () => now
    });
    const previousLimit = process.env.EODHD_DAILY_CALL_LIMIT;
    process.env.EODHD_DAILY_CALL_LIMIT = '10';
    const response = responseRecorder();
    try {
      await withCronSecret(() => handler({ method: 'POST', headers: { authorization: 'Bearer test-secret' } }, response));
    } finally {
      if (previousLimit === undefined) delete process.env.EODHD_DAILY_CALL_LIMIT;
      else process.env.EODHD_DAILY_CALL_LIMIT = previousLimit;
    }
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.reason, 'partial');
    assert.ok(response.body.problems.some((problem) => problem.status === 'nav_incomplete'));
    assert.equal(applyCalled, false);
  });

  test('performance_rows 0/1/duplicate sunt respinse; exact US+EU trece', () => {
    const us = { portfolio_id: 'us-id', portfolio_code: 'US', currency: 'GBP', as_of_date: '2026-08-14', nav_value: 100, capital_contributed: 100, cumulative_return_pct: 0, return_is_pending: false };
    const eu = { portfolio_id: 'eu-id', portfolio_code: 'EU', currency: 'EUR', as_of_date: '2026-08-14', nav_value: 100, capital_contributed: 100, cumulative_return_pct: 0, return_is_pending: false };
    assert.equal(validatePerformanceRowsContract([]), 'performance_rows_count');
    assert.equal(validatePerformanceRowsContract([us]), 'performance_rows_count');
    assert.equal(validatePerformanceRowsContract([us, { ...us }]), 'performance_rows_us_eu');
    assert.equal(validatePerformanceRowsContract([us, eu]), null);
    assert.equal(validatePerformanceRowsContract([{ ...us, nav_value: -1 }, eu]), 'performance_nav_invalid');
    assert.equal(validatePerformanceRowsContract([{ ...us, return_is_pending: true, cumulative_return_pct: 1 }, eu]), 'performance_pending_return_must_be_null');
    assert.equal(validatePerformanceRowsContract([{ ...us, cumulative_return_pct: null }, eu]), 'performance_return_invalid');
  });
});

describe('FX si return_is_pending', () => {
  test('cursuri istorice 0/negative/NaN/overflow sunt ignorate, conversia ramane incompleta', () => {
    for (const rate of [0, -1, NaN, Infinity]) {
      const { convertAsOf } = createFxConverter([{ base_currency: 'USD', quote_currency: 'GBP', rate, as_of_date: '2026-08-14' }]);
      assert.equal(convertAsOf(100, 'USD', 'GBP', '2026-08-14'), null);
    }
  });

  test('pending este text localizat explicit in badge-ul ultimului punct si tooltip', () => {
    const source = readFileSync(new URL('../member-portfolios.js', import.meta.url), 'utf8');
    const sandbox = {
      __TSB_TEST_HOOKS__: {},
      document: {
        readyState: 'loading',
        addEventListener() {},
        createElement() { return { getContext: () => ({ measureText: (text) => ({ width: String(text).length * 6 }) }) }; }
      },
      console,
      Intl,
      Date,
      Math,
      Number,
      setInterval() { return 1; },
      clearInterval() {}
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    runInNewContext(source, sandbox, { filename: 'member-portfolios.js' });
    const hooks = sandbox.__TSB_TEST_HOOKS__.memberPortfolios;
    assert.ok(hooks, 'hook-ul exact de render nu a fost expus');

    const history = [
      { asOfDate: '2026-08-07', navValue: 100, capitalContributed: 100, cumulativeReturnPct: 0, returnIsPending: false },
      { asOfDate: '2026-08-14', navValue: 120, capitalContributed: 100, cumulativeReturnPct: null, returnIsPending: true }
    ];
    const chartWrap = { clientWidth: 760, innerHTML: '', querySelector: () => null };
    hooks.drawChart(chartWrap, history, { code: 'US', currency: 'GBP', capital: 100, founded: '2026-08-07' });
    assert.match(chartWrap.innerHTML, /data-return-state="pending"/);
    assert.match(chartWrap.innerHTML, /Randament în calcul \(TWR\)/);

    const listeners = {};
    const plot = {
      addEventListener(name, fn) { listeners[name] = fn; },
      getBoundingClientRect() { return { left: 0, width: 100 }; }
    };
    const tooltip = { innerHTML: '', hidden: true, style: {}, offsetWidth: 170, offsetHeight: 130 };
    const tooltipWrap = {
      querySelector(selector) { return selector === '.mp-chart-plot' ? plot : tooltip; },
      contains() { return true; }
    };
    hooks.wireChartInteraction(tooltipWrap, [
      { xPct: 0, yPct: 50, h: history[0] },
      { xPct: 100, yPct: 40, h: history[1] }
    ], 'GBP', '2026-08-07');
    listeners.pointerdown({ clientX: 100 });
    assert.equal(tooltip.hidden, false);
    assert.match(tooltip.innerHTML, /is-pending/);
    assert.match(tooltip.innerHTML, /Randament în calcul \(TWR\)/);

    const apiSource = readFileSync(new URL('../api/account-portfolios.js', import.meta.url), 'utf8');
    assert.match(apiSource, /cumulative_return_pct, return_is_pending, currency/);
    assert.match(apiSource, /returnIsPending: x\.return_is_pending === true/);
  });
});

describe('lease inainte de fetch/read', () => {
  test('doua runs concurente: exact unul obtine lease; owner-ul il elibereaza', async () => {
    let owner = null;
    const admin = {
      async rpc(name, args) {
        if (name === 'acquire_portfolio_sync_lease') {
          if (owner === null) owner = args.p_owner;
          return { data: { acquired: owner === args.p_owner }, error: null };
        }
        if (name === 'release_portfolio_sync_lease') {
          const released = owner === args.p_owner;
          if (released) owner = null;
          return { data: released, error: null };
        }
        throw new Error('RPC neasteptat');
      }
    };
    const results = await Promise.all([acquireSyncLease(admin, 'run-1'), acquireSyncLease(admin, 'run-2')]);
    assert.deepEqual(results, [true, false]);
    await releaseSyncLease(admin, 'run-1');
    assert.equal(owner, null);
  });

  test('handlerul real apeleaza acquire primul si nu citeste/fetcheaza cand este locked', async () => {
    const events = [];
    const admin = {
      async rpc(name) {
        events.push(`rpc:${name}`);
        return { data: { acquired: false }, error: null };
      },
      from(table) {
        events.push(`from:${table}`);
        return { insert: async () => ({ error: null }) };
      }
    };
    let fetchCalled = false;
    const handler = createSyncHandler({
      getAdmin: () => admin,
      fetchPrices: async () => { fetchCalled = true; return []; },
      fetchFxRates: async () => { fetchCalled = true; return []; },
      createRunId: () => '00000000-0000-4000-8000-000000000001'
    });
    const previous = process.env.PORTFOLIO_CRON_SECRET;
    process.env.PORTFOLIO_CRON_SECRET = 'test-secret';
    const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
    try {
      await handler({ method: 'POST', headers: { authorization: 'Bearer test-secret' } }, response);
    } finally {
      if (previous === undefined) delete process.env.PORTFOLIO_CRON_SECRET;
      else process.env.PORTFOLIO_CRON_SECRET = previous;
    }
    assert.equal(response.statusCode, 409);
    assert.equal(fetchCalled, false);
    assert.deepEqual(events, ['rpc:acquire_portfolio_sync_lease', 'from:portfolio_sync_runs']);
  });

  test('audit helper inspecteaza error si raporteaza failure fara mesaj brut', async () => {
    const original = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args.join(' '));
    try {
      const ok = await logSyncRun({ from: () => ({ insert: async () => ({ error: { message: 'secret raw db detail' } }) }) }, {
        runId: 'run', applied: false, reason: 'server_error', problems: []
      });
      assert.equal(ok, false);
      assert.deepEqual(logs, ['[portfolio-sync] audit insert failed']);
    } finally {
      console.error = original;
    }
  });

  test('SQL real permite takeover numai dupa TTL si release numai owner-ului', () => {
    const sql = readFileSync(new URL('../supabase/migrations/202608140003_portfolio_sync_runs.sql', import.meta.url), 'utf8');
    assert.match(sql, /expires_at <= clock_timestamp\(\)/);
    assert.match(sql, /lease_name = 'portfolio_price_sync' and owner = p_owner/);
  });
});

describe('admin mapping lifecycle', () => {
  test('active unmapped PATCH rezultat este respins', () => {
    assert.match(validatePortfolioPositionState({
      instrument_currency: 'USD', active: true,
      provider_symbol: null, provider_price_multiplier: 1
    }), /cod EODHD/);
  });

  test('DKK si SEK sunt acceptate cu mapping valid', () => {
    for (const currency of ['DKK', 'SEK']) {
      assert.equal(validatePortfolioPositionState({
        instrument_currency: currency, active: true,
        provider_symbol: currency === 'SEK' ? 'INVE-B.ST' : 'NOVO-B.CO',
        provider_price_multiplier: 1
      }), null);
    }
  });

  test('seed, admin, DB allowlist si session registry au aceeasi acoperire', () => {
    const seed = readFileSync(new URL('../supabase/seeds/202608140001_provider_symbol_seed.sql', import.meta.url), 'utf8');
    const seedSymbols = [...seed.matchAll(/\('(?:US|EU)',\s*'[^']+',\s*'([^']+)',/g)].map((match) => match[1]);
    assert.equal(seedSymbols.length, 20, 'toate mappingurile active din seed trebuie parsate');
    for (const providerSymbol of seedSymbols) {
      assert.equal(hasMarketSessionPolicy(providerSymbol), true, providerSymbol);
      assert.equal(validatePortfolioPositionState({
        instrument_currency: 'USD', quantity: 0, avg_price: 0, active: true,
        provider_symbol: providerSymbol, provider_price_multiplier: 1
      }), null, providerSymbol);
    }

    const mappingSql = readFileSync(new URL('../supabase/migrations/202608140001_add_provider_symbol_mapping.sql', import.meta.url), 'utf8');
    const allowlistMatch = mappingSql.match(/array\[([^\]]+)\]::text\[\]/);
    assert.ok(allowlistMatch, 'allowlist DB lipsa');
    const dbSuffixes = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
    assert.deepEqual(dbSuffixes, [...SUPPORTED_MARKET_SUFFIXES].sort());
    assert.equal(hasMarketSessionPolicy('NOVO-B.CO'), true);
    assert.match(validatePortfolioPositionState({
      instrument_currency: 'DKK', quantity: 1, avg_price: 100, active: true,
      provider_symbol: 'NOVO-B.OL', provider_price_multiplier: 1
    }), /fara politica de sesiune/);
    const unsupported = validatePortfolioUniverse(portfolios, [
      validPosition({ provider_symbol: 'NOVO-B.OL' }),
      validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', provider_symbol: 'SAP.XETRA' })
    ]);
    assert.ok(unsupported.some((problem) => problem.status === 'unsupported_market_session'));
  });

  test('provider_symbol whitespace este normalizat canonic cross-layer', () => {
    const rawBody = {
      instrument_currency: 'USD', quantity: 1, avg_price: 100, active: true,
      provider_symbol: ' AAPL.US ', provider_price_multiplier: 1
    };
    const normalizedBody = normalizePortfolioPositionBody(rawBody);
    assert.equal(normalizedBody.provider_symbol, 'AAPL.US');
    assert.equal(normalizeProviderSymbol(rawBody.provider_symbol), 'AAPL.US');
    assert.equal(validatePortfolioPositionState(normalizedBody), null);
    assert.equal(hasMarketSessionPolicy(rawBody.provider_symbol), true);

    const rawPositions = [
      validPosition({ provider_symbol: ' AAPL.US ' }),
      validPosition({ id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', provider_symbol: 'SAP.XETRA' })
    ];
    assert.deepEqual(buildProviderRequestPlan(portfolios, rawPositions, [], []).symbols, ['AAPL.US', 'SAP.XETRA']);
    assert.equal(buildEvaluationBasis(portfolios, rawPositions, [], [], []).positions
      .find((row) => row.id === 'position-id').provider_symbol, 'AAPL.US');
    assert.equal(validatePortfolioUniverse(portfolios, rawPositions)
      .some((problem) => ['unmapped', 'unsupported_market_session'].includes(problem.status)), false);

    const blankBody = normalizePortfolioPositionBody({ ...rawBody, provider_symbol: '   ' });
    assert.equal(blankBody.provider_symbol, '');
    assert.match(validatePortfolioPositionState(blankBody), /cod EODHD/);
    const blankProblems = validatePortfolioUniverse(portfolios, [
      validPosition({ provider_symbol: '   ' }),
      rawPositions[1]
    ]);
    assert.ok(blankProblems.some((problem) => problem.status === 'unmapped'));

    const mappingSql = readFileSync(new URL('../supabase/migrations/202608140001_add_provider_symbol_mapping.sql', import.meta.url), 'utf8');
    assert.match(mappingSql, /provider_symbol = btrim\(provider_symbol\)/);
    assert.match(mappingSql, /btrim\(provider_symbol\) ~ '\^\.\+\\\.\[A-Za-z0-9\]\+\$'/);
    assert.match(mappingSql, /regexp_replace\(btrim\(provider_symbol\)/);

    const adminSource = readFileSync(new URL('../api/admin/[name].js', import.meta.url), 'utf8');
    assert.match(adminSource, /normalize: normalizePortfolioPositionBody/);
    assertCrudNormalizationWiring(adminSource);
    const withoutNormalizeCall = adminSource.replace('if (opts.normalize) body = opts.normalize(body);', '');
    assert.throws(() => assertCrudNormalizationWiring(withoutNormalizeCall), /opts\.normalize lipseste/);
  });

  test('handlerul CRUD real trim-uieste INSERT/PATCH si blocheaza whitespace-only fara write', async () => {
    const writes = [];
    const existing = {
      id: 'position-1', portfolio_id: 'us-id', ticker: 'AAPL', name: 'Apple',
      instrument_currency: 'USD', quantity: 1, avg_price: 100, current_price: 110,
      active: true, provider_symbol: 'MSFT.US', provider_price_multiplier: 1
    };
    const client = {
      from(table) {
        assert.equal(table, 'portfolio_positions');
        return {
          insert(payload) {
            writes.push({ operation: 'insert', payload });
            return { select: () => ({ single: async () => ({ data: { ...payload, id: 'inserted-id' }, error: null }) }) };
          },
          select() {
            return { eq: () => ({ single: async () => ({ data: existing, error: null }) }) };
          },
          update(payload) {
            writes.push({ operation: 'update', payload });
            return {
              eq: () => ({
                select: () => ({ single: async () => ({ data: { ...existing, ...payload }, error: null }) })
              })
            };
          }
        };
      }
    };
    const deps = { requireAdminImpl: async () => ({ client }) };
    const baseBody = {
      portfolio_id: 'us-id', ticker: 'AAPL', name: 'Apple', instrument_currency: 'USD',
      quantity: 1, avg_price: 100, active: true,
      provider_symbol: ' AAPL.US ', provider_price_multiplier: 1
    };

    const postResponse = responseRecorder();
    await handleCrudTable({ method: 'POST', body: baseBody, query: {}, headers: {} }, postResponse, PORTFOLIO_POSITION_CRUD_OPTIONS, deps);
    assert.equal(postResponse.statusCode, 200);
    assert.equal(writes[0].operation, 'insert');
    assert.equal(writes[0].payload.provider_symbol, 'AAPL.US');
    assert.equal(postResponse.body.row.provider_symbol, 'AAPL.US');

    const patchResponse = responseRecorder();
    await handleCrudTable({
      method: 'PATCH', body: { id: existing.id, provider_symbol: ' AAPL.US ' }, query: {}, headers: {}
    }, patchResponse, PORTFOLIO_POSITION_CRUD_OPTIONS, deps);
    assert.equal(patchResponse.statusCode, 200);
    assert.equal(writes[1].operation, 'update');
    assert.equal(writes[1].payload.provider_symbol, 'AAPL.US');
    assert.equal(patchResponse.body.row.provider_symbol, 'AAPL.US');

    const writesBeforeInvalid = writes.length;
    const blankPostResponse = responseRecorder();
    await handleCrudTable({
      method: 'POST', body: { ...baseBody, provider_symbol: '   ' }, query: {}, headers: {}
    }, blankPostResponse, PORTFOLIO_POSITION_CRUD_OPTIONS, deps);
    assert.equal(blankPostResponse.statusCode, 400);
    assert.equal(writes.length, writesBeforeInvalid);

    const blankPatchResponse = responseRecorder();
    await handleCrudTable({
      method: 'PATCH', body: { id: existing.id, provider_symbol: '   ', active: true }, query: {}, headers: {}
    }, blankPatchResponse, PORTFOLIO_POSITION_CRUD_OPTIONS, deps);
    assert.equal(blankPatchResponse.statusCode, 400);
    assert.equal(writes.length, writesBeforeInvalid);
  });

  test('BUY negativ/quantity negativa, dividend negativ si position quantity negativa sunt respinse la intrare', () => {
    assert.match(validatePortfolioTransactionState({
      type: 'BUY', currency: 'GBP', amount: -100, quantity: 1, price: 100, fee_amount: 0
    }), /amount/);
    assert.match(validatePortfolioTransactionState({
      type: 'BUY', currency: 'GBP', amount: 100, quantity: -1, price: 100, fee_amount: 0
    }), /quantity/);
    assert.match(validatePortfolioTransactionState({
      type: 'BUY', currency: 'GBP', amount: 100, quantity: 1, price: 100, fee_amount: -1
    }), /fee_amount/);
    assert.match(validatePortfolioDividendState({ currency: 'EUR', amount: -1 }), /amount/);
    assert.match(validatePortfolioPositionState({
      instrument_currency: 'USD', quantity: -1, avg_price: 10, current_price: 10,
      active: true, provider_symbol: 'AAPL.US', provider_price_multiplier: 1
    }), /quantity/);

    const migration = readFileSync(new URL('../supabase/migrations/202608140002_add_fx_rate_timestamp_and_pending_return.sql', import.meta.url), 'utf8');
    for (const constraint of [
      'portfolio_positions_quantity_domain_check',
      'portfolio_transactions_amount_domain_check',
      'portfolio_transactions_fee_domain_check',
      'portfolio_transactions_trade_fields_check',
      'portfolio_dividends_amount_domain_check'
    ]) assert.match(migration, new RegExp(constraint));
  });

  test('performance admin impune NAV/capital si relatia pending/null', () => {
    const base = {
      currency: 'GBP', nav_value: 100, capital_contributed: 100,
      cumulative_return_pct: 0, return_is_pending: false
    };
    assert.equal(validatePortfolioPerformanceState(base), null);
    assert.match(validatePortfolioPerformanceState({ ...base, nav_value: -1 }), /nav_value/);
    assert.match(validatePortfolioPerformanceState({ ...base, nav_value: null }), /nav_value/);
    assert.match(validatePortfolioPerformanceState({ ...base, capital_contributed: 0 }), /capital_contributed/);
    assert.match(validatePortfolioPerformanceState({ ...base, return_is_pending: true }), /null/);
    assert.equal(validatePortfolioPerformanceState({ ...base, return_is_pending: true, cumulative_return_pct: null }), null);
    assert.match(validatePortfolioPerformanceState({ ...base, cumulative_return_pct: null }), /finit/);

    const migration = readFileSync(new URL('../supabase/migrations/202608140002_add_fx_rate_timestamp_and_pending_return.sql', import.meta.url), 'utf8');
    assert.match(migration, /return_is_pending = true and cumulative_return_pct is null/);
    assert.match(migration, /return_is_pending = false[\s\S]*cumulative_return_pct is not null/);
    const rpcSql = readFileSync(new URL('../supabase/migrations/202608140004_sync_lock_and_atomic_snapshot_function.sql', import.meta.url), 'utf8');
    assert.match(rpcSql, /numeric_value < 0[\s\S]*NAV must be complete, finite and non-negative/);
    assert.match(rpcSql, /pending and perf->>'cumulative_return_pct' is not null/);
  });

  test('rollback-ul 002 elimina simetric toate constraints adaugate de migrare', () => {
    const migration = readFileSync(new URL('../supabase/migrations/202608140002_add_fx_rate_timestamp_and_pending_return.sql', import.meta.url), 'utf8');
    const rollback = readFileSync(new URL('../supabase/rollbacks/202608140002_add_fx_rate_timestamp_and_pending_return_rollback.sql', import.meta.url), 'utf8');
    const added = [...migration.matchAll(/add constraint\s+([a-z0-9_]+)/gi)].map((match) => match[1]).sort();
    const dropped = [...rollback.matchAll(/drop constraint if exists\s+([a-z0-9_]+)/gi)].map((match) => match[1]).sort();
    assert.equal(added.length, 14, 'toate constraints adaugate/reinlocuite de 002');
    assert.deepEqual(dropped, added);
  });
});

describe('audit/banner reasons', () => {
  test('quota si server errors aprind bannerul; locked nu produce fals pozitiv', () => {
    for (const reason of ['partial', 'fetch_failed', 'quota_unconfigured', 'quota_exhausted', 'server_error', 'state_changed']) {
      assert.equal(isSyncPublicationIssue(reason), true, reason);
    }
    assert.equal(isSyncPublicationIssue('locked'), false);
    assert.equal(isSyncPublicationIssue('ok'), false);
  });

  test('server_error dupa fetch pastreaza provider_call_units in auditul handlerului real', async () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const positionRows = [
      validPosition({
        id: 'us-pos', ticker: 'VUKE', instrument_currency: 'GBP', quantity: 1,
        avg_price: 10, current_price: 10, provider_symbol: 'VUKE.LSE'
      }),
      validPosition({
        id: 'eu-pos', portfolio_id: 'eu-id', ticker: 'SAP', instrument_currency: 'EUR', quantity: 1,
        avg_price: 10, current_price: 10, provider_symbol: 'SAP.XETRA'
      })
    ];
    const transactionRows = [
      { id: 'tx-us', portfolio_id: 'us-id', type: 'DEPOSIT', amount: 100, fee_amount: 0, currency: 'GBP', executed_at: '2026-08-01T10:00:00Z' },
      { id: 'tx-eu', portfolio_id: 'eu-id', type: 'DEPOSIT', amount: 100, fee_amount: 0, currency: 'EUR', executed_at: '2026-08-01T10:00:00Z' }
    ];
    const rows = {
      portfolios: portfolios.map((row) => ({ ...row, initial_capital: 100, founded_date: '2026-08-01' })),
      portfolio_positions: positionRows,
      portfolio_transactions: transactionRows,
      portfolio_dividends: [], fx_rates: [], portfolio_sync_runs: []
    };
    const audits = [];
    const admin = {
      async rpc(name) {
        if (name === 'acquire_portfolio_sync_lease') return { data: { acquired: true }, error: null };
        if (name === 'apply_portfolio_price_snapshot') return { data: null, error: { message: 'raw rpc error' } };
        if (name === 'release_portfolio_sync_lease') return { data: true, error: null };
        throw new Error(`RPC neasteptat: ${name}`);
      },
      from(table) {
        return queryResult({ data: rows[table], error: null }, {
          async insert(value) { audits.push(value); return { error: null }; }
        });
      }
    };
    const handler = createSyncHandler({
      getAdmin: () => admin,
      fetchPrices: async () => positionRows.map((row) => ({
        providerSymbol: row.provider_symbol, price: 10, providerTimestamp: '2026-08-10T11:50:00Z'
      })),
      fetchFxRates: async () => [],
      createRunId: () => '00000000-0000-4000-8000-000000000003',
      clock: () => now
    });
    const previousLimit = process.env.EODHD_DAILY_CALL_LIMIT;
    process.env.EODHD_DAILY_CALL_LIMIT = '10';
    const originalError = console.error;
    console.error = () => {};
    const response = responseRecorder();
    try {
      await withCronSecret(() => handler({ method: 'POST', headers: { authorization: 'Bearer test-secret' } }, response));
    } finally {
      console.error = originalError;
      if (previousLimit === undefined) delete process.env.EODHD_DAILY_CALL_LIMIT;
      else process.env.EODHD_DAILY_CALL_LIMIT = previousLimit;
    }
    assert.equal(response.statusCode, 500);
    const serverAudit = audits.find((row) => row.reason === 'server_error');
    assert.ok(serverAudit);
    assert.equal(serverAudit.provider_call_units, 2);
    assert.equal(serverAudit.provider_symbols_requested, 2);
    assert.equal(serverAudit.quota_projected, 2);
  });
});
