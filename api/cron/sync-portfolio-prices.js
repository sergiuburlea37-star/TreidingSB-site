// Synchronizare atomica EODHD Live Delayed pentru portofoliile US + EU.
// Cronul ramane dormant; vezi docs/eodhd-rollout.md si migrarea 202608140005.

import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { createFxConverter } from '../_lib/fx-convert.js';
import {
  dedupeProviderSymbols,
  fetchLiveDelayedPrices,
  fetchLiveDelayedFxRates,
  classifyQuoteFreshness,
  hasMarketSessionPolicy,
  isWeeklyFinalWindow,
  normalizeProviderSymbol,
  isKnownEodhdFetchErrorCategory
} from '../_lib/eodhd.js';
import {
  computeLedgerCashBaseCcy,
  computeNetCapitalContributedBaseCcy,
  hasPostFoundingCashFlow
} from '../_lib/portfolio-math.js';

export const SYNC_LEASE_TTL_SECONDS = 180;
const REQUIRED_PORTFOLIO_CODES = ['EU', 'US'];

function isPositiveFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isNonNegativeFinite(value) {
  if (value == null || value === '') return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

export function buildProviderRequestPlan(portfolios, positions, transactions, dividends) {
  const portfolioById = new Map((portfolios || []).map((p) => [p.id, p]));
  const symbols = dedupeProviderSymbols((positions || []).map((p) => p.provider_symbol));
  const fxPairByKey = new Map();
  function addPair(currency, portfolioId) {
    const portfolio = portfolioById.get(portfolioId);
    if (!currency || !portfolio || currency === portfolio.base_currency) return;
    const key = `${currency}_${portfolio.base_currency}`;
    if (!fxPairByKey.has(key)) fxPairByKey.set(key, { base: currency, quote: portfolio.base_currency });
  }
  for (const row of positions || []) addPair(row.instrument_currency, row.portfolio_id);
  for (const row of transactions || []) addPair(row.currency, row.portfolio_id);
  for (const row of dividends || []) addPair(row.currency, row.portfolio_id);
  const fxPairs = [...fxPairByKey.values()];
  return {
    symbols,
    fxPairs,
    providerCallUnits: symbols.length + fxPairs.length
  };
}

export function evaluateQuotaPreflight({ dailyLimit, usedToday, requestedUnits }) {
  const limit = Number(dailyLimit);
  const used = Number(usedToday) || 0;
  const requested = Number(requestedUnits) || 0;
  if (!Number.isInteger(limit) || limit <= 0) {
    return { allowed: false, reason: 'quota_unconfigured', used, requested, limit: null, projected: used };
  }
  const projected = used + requested;
  return {
    allowed: projected <= limit,
    reason: projected <= limit ? 'ok' : 'quota_exhausted',
    used,
    requested,
    limit,
    projected,
    warning: projected >= Math.floor(limit * 0.8)
  };
}

export function validatePerformanceRowsContract(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) return 'performance_rows_count';
  const codes = rows.map((row) => row && row.portfolio_code).sort();
  if (codes[0] !== 'EU' || codes[1] !== 'US') return 'performance_rows_us_eu';
  if (!rows.every((row) => row && row.portfolio_id && row.currency && row.as_of_date)) return 'performance_rows_incomplete';
  for (const row of rows) {
    if (!isNonNegativeFinite(row.nav_value)) return 'performance_nav_invalid';
    if (!isPositiveFinite(row.capital_contributed)) return 'performance_capital_invalid';
    if (typeof row.return_is_pending !== 'boolean') return 'performance_pending_invalid';
    if (row.return_is_pending) {
      if (row.cumulative_return_pct != null) return 'performance_pending_return_must_be_null';
    } else if (row.cumulative_return_pct == null || row.cumulative_return_pct === '' || !Number.isFinite(Number(row.cumulative_return_pct))) {
      return 'performance_return_invalid';
    }
  }
  return null;
}

function byId(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

function utcDate(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function utcTimestamp(value) {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function buildEvaluationBasis(portfolios, positions, transactions, dividends, fxRates = []) {
  return {
    portfolios: [...(portfolios || [])].sort(byId).map((row) => ({
      id: row.id,
      code: row.code,
      base_currency: row.base_currency,
      founded_date: row.founded_date
    })),
    positions: [...(positions || [])].sort(byId).map((row) => ({
      id: row.id,
      portfolio_id: row.portfolio_id,
      active: true,
      instrument_currency: row.instrument_currency,
      quantity: Number(row.quantity),
      avg_price: Number(row.avg_price),
      current_price: row.current_price == null ? null : Number(row.current_price),
      price_updated_at: utcTimestamp(row.price_updated_at),
      price_source: row.price_source == null ? null : row.price_source,
      provider_symbol: normalizeProviderSymbol(row.provider_symbol),
      provider_price_multiplier: Number(row.provider_price_multiplier)
    })),
    transactions: [...(transactions || [])].sort(byId).map((row) => ({
      id: row.id,
      portfolio_id: row.portfolio_id,
      type: row.type,
      amount: Number(row.amount),
      quantity: row.quantity == null ? null : Number(row.quantity),
      price: row.price == null ? null : Number(row.price),
      fee_amount: Number(row.fee_amount == null ? 0 : row.fee_amount),
      currency: row.currency,
      executed_date: utcDate(row.executed_at)
    })),
    dividends: [...(dividends || [])].sort(byId).map((row) => ({
      id: row.id,
      portfolio_id: row.portfolio_id,
      amount: Number(row.amount),
      currency: row.currency
    })),
    fx_rates: [...(fxRates || [])].sort(byId).map((row) => ({
      id: row.id,
      base_currency: row.base_currency,
      quote_currency: row.quote_currency,
      rate: Number(row.rate),
      as_of_date: row.as_of_date,
      source: row.source,
      provider_fetched_at: utcTimestamp(row.provider_fetched_at)
    }))
  };
}

export async function acquireSyncLease(admin, runId, ttlSeconds = SYNC_LEASE_TTL_SECONDS) {
  const { data, error } = await admin.rpc('acquire_portfolio_sync_lease', {
    p_owner: runId,
    p_ttl_seconds: ttlSeconds
  });
  if (error) throw new Error('lease_acquire_failed');
  return !!(data && data.acquired === true);
}

export async function releaseSyncLease(admin, runId) {
  const { error } = await admin.rpc('release_portfolio_sync_lease', { p_owner: runId });
  if (error) throw new Error('lease_release_failed');
}

export async function logSyncRun(admin, {
  runId, applied, reason, problems, providerCallUnits = 0,
  providerSymbolsRequested = 0, quotaLimit = null, quotaProjected = null
}) {
  try {
    const { error } = await admin.from('portfolio_sync_runs').insert({
      id: runId,
      finished_at: new Date().toISOString(),
      applied,
      reason,
      problems: problems || [],
      provider_call_units: providerCallUnits,
      provider_symbols_requested: providerSymbolsRequested,
      quota_limit: quotaLimit,
      quota_projected: quotaProjected
    });
    if (error) {
      console.error('[portfolio-sync] audit insert failed');
      return false;
    }
    return true;
  } catch (_) {
    console.error('[portfolio-sync] audit insert failed');
    return false;
  }
}

export function validatePortfolioUniverse(portfolios, positions) {
  const codes = (portfolios || []).map((p) => p.code).sort();
  const problems = [];
  if (codes.length !== 2 || codes.some((code, index) => code !== REQUIRED_PORTFOLIO_CODES[index])) {
    problems.push({ ticker: null, portfolio: null, status: 'invalid_portfolio_universe' });
  }
  const ids = new Set((portfolios || []).map((p) => p.id));
  for (const position of positions || []) {
    if (!ids.has(position.portfolio_id)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'unknown_portfolio' });
    }
    if (!position.provider_symbol || !String(position.provider_symbol).trim()) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'unmapped' });
    } else if (!hasMarketSessionPolicy(position.provider_symbol)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'unsupported_market_session' });
    }
    if (!isPositiveFinite(position.provider_price_multiplier)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'invalid_multiplier' });
    }
    if (!isNonNegativeFinite(position.quantity)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'missing_quantity' });
    }
    if (!isNonNegativeFinite(position.avg_price) || (Number(position.quantity) > 0 && !isPositiveFinite(position.avg_price))) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'invalid_avg_price' });
    }
    if (position.current_price != null && !isPositiveFinite(position.current_price)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'invalid_current_price' });
    }
    if (position.price_updated_at != null && !utcTimestamp(position.price_updated_at)) {
      problems.push({ ticker: position.ticker, portfolio: null, status: 'invalid_price_timestamp' });
    }
  }
  for (const portfolio of portfolios || []) {
    if (!(positions || []).some((position) => position.portfolio_id === portfolio.id)) {
      problems.push({ ticker: null, portfolio: portfolio.code, status: 'no_active_positions' });
    }
  }
  return problems;
}

export function validateLedgerRows(transactions, dividends) {
  const problems = [];
  for (const row of transactions || []) {
    if (!isPositiveFinite(row.amount)) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_transaction_amount' });
    }
    if (!['BUY', 'SELL', 'FEE', 'DEPOSIT', 'WITHDRAWAL'].includes(row.type)) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_transaction_type' });
    }
    if (!isNonNegativeFinite(row.fee_amount == null ? 0 : row.fee_amount)) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_transaction_fee' });
    }
    if (row.type === 'BUY' || row.type === 'SELL') {
      if (!isPositiveFinite(row.quantity) || !isPositiveFinite(row.price)) {
        problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_trade_quantity_or_price' });
      }
    } else if ((row.quantity != null && !isPositiveFinite(row.quantity)) || (row.price != null && !isPositiveFinite(row.price))) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_transaction_quantity_or_price' });
    }
    if (!utcDate(row.executed_at)) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_transaction_date' });
    }
  }
  for (const row of dividends || []) {
    if (!isPositiveFinite(row.amount)) {
      problems.push({ ticker: null, portfolio: row.portfolio_id, status: 'invalid_dividend_amount' });
    }
  }
  return problems;
}

export function createSyncHandler({
  getAdmin = getSupabaseAdmin,
  fetchPrices = fetchLiveDelayedPrices,
  fetchFxRates = fetchLiveDelayedFxRates,
  createRunId = randomUUID,
  clock = () => new Date()
} = {}) {
  return async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!process.env.PORTFOLIO_CRON_SECRET || authHeader !== `Bearer ${process.env.PORTFOLIO_CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = getAdmin();
  const runId = createRunId();
  let leaseAcquired = false;
  let attemptedProviderCallUnits = 0;
  let attemptedProviderSymbols = 0;
  let auditQuotaLimit = null;
  let auditQuotaProjected = null;
  // Etapa curenta de executie - loghata DOAR ca eticheta in catch-ul extern
  // (niciodata error.message/stack/date din DB), ca sa localizam rapid un
  // 500 generic fara sa expunem nimic sensibil.
  let stage = 'lease';

  try {
    // Invariant: aceasta este prima operatie DB. Nicio citire/fetch nu are loc fara lease.
    leaseAcquired = await acquireSyncLease(admin, runId);
    if (!leaseAcquired) {
      await logSyncRun(admin, { runId, applied: false, reason: 'locked', problems: [] });
      return res.status(409).json({ success: true, applied: false, reason: 'locked' });
    }

    stage = 'db_read';
    const now = clock();
    const todayIso = now.toISOString().slice(0, 10);
    const dayStartIso = `${todayIso}T00:00:00.000Z`;
    const [portfoliosRes, positionsRes, txRes, divRes, fxRes, usageRes] = await Promise.all([
      admin.from('portfolios').select('id, code, base_currency, initial_capital, founded_date').in('code', REQUIRED_PORTFOLIO_CODES),
      admin.from('portfolio_positions')
        .select('id, portfolio_id, ticker, instrument_currency, quantity, avg_price, current_price, price_updated_at, price_source, provider_symbol, provider_price_multiplier')
        .eq('active', true),
      admin.from('portfolio_transactions').select('id, portfolio_id, type, quantity, price, amount, fee_amount, currency, executed_at'),
      admin.from('portfolio_dividends').select('id, portfolio_id, amount, currency'),
      admin.from('fx_rates').select('id, base_currency, quote_currency, rate, as_of_date, source, provider_fetched_at').order('as_of_date', { ascending: false }),
      admin.from('portfolio_sync_runs').select('provider_call_units').gte('started_at', dayStartIso)
    ]);

    for (const result of [portfoliosRes, positionsRes, txRes, divRes, fxRes, usageRes]) {
      if (result.error) throw new Error('db_read_failed');
    }

    stage = 'validate';
    const portfolios = portfoliosRes.data || [];
    const positions = (positionsRes.data || []).map((row) => ({
      ...row,
      provider_symbol: normalizeProviderSymbol(row.provider_symbol)
    }));
    const transactions = txRes.data || [];
    const dividends = divRes.data || [];
    const existingFxRows = fxRes.data || [];
    const portfolioById = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));

    const universeProblems = [
      ...validatePortfolioUniverse(portfolios, positions),
      ...validateLedgerRows(transactions, dividends)
    ];
    if (universeProblems.length) {
      await logSyncRun(admin, { runId, applied: false, reason: 'partial', problems: universeProblems });
      return res.status(200).json({ success: true, applied: false, reason: 'partial', problems: universeProblems });
    }

    stage = 'quota';
    const requestPlan = buildProviderRequestPlan(portfolios, positions, transactions, dividends);
    const evaluationBasis = buildEvaluationBasis(portfolios, positions, transactions, dividends, existingFxRows);
    const usedToday = (usageRes.data || []).reduce((sum, row) => sum + (Number(row.provider_call_units) || 0), 0);
    const quota = evaluateQuotaPreflight({
      dailyLimit: process.env.EODHD_DAILY_CALL_LIMIT,
      usedToday,
      requestedUnits: requestPlan.providerCallUnits
    });
    if (!quota.allowed) {
      await logSyncRun(admin, {
        runId, applied: false, reason: quota.reason, problems: [],
        providerSymbolsRequested: requestPlan.providerCallUnits,
        quotaLimit: quota.limit, quotaProjected: quota.projected
      });
      return res.status(200).json({ success: true, applied: false, reason: quota.reason, quota });
    }

    attemptedProviderCallUnits = requestPlan.providerCallUnits;
    attemptedProviderSymbols = requestPlan.providerCallUnits;
    auditQuotaLimit = quota.limit;
    auditQuotaProjected = quota.projected;
    stage = 'fetch';
    let priceQuotes;
    let fxQuotes;
    try {
      [priceQuotes, fxQuotes] = await Promise.all([
        fetchPrices(requestPlan.symbols),
        fetchFxRates(requestPlan.fxPairs)
      ]);
    } catch (err) {
      // Doar categoria sanitizata ajunge in audit/raspuns - niciodata
      // err.message brut (poate contine detalii de la EODHD).
      const category = (err && isKnownEodhdFetchErrorCategory(err.category))
        ? err.category
        : 'eodhd_unknown_fetch_error';
      const fetchProblems = [{ ticker: null, portfolio: null, status: category }];
      await logSyncRun(admin, {
        runId, applied: false, reason: 'fetch_failed', problems: fetchProblems,
        providerCallUnits: requestPlan.providerCallUnits,
        providerSymbolsRequested: requestPlan.providerCallUnits,
        quotaLimit: quota.limit, quotaProjected: quota.projected
      });
      return res.status(200).json({ success: true, applied: false, reason: 'fetch_failed', problems: fetchProblems });
    }

    stage = 'process_quotes';
    // Doar pt. etichetarea snapshot_kind mai jos - classifyQuoteFreshness nu
    // mai citeste acest steag, decide singura, per simbol, din orele reale
    // ale bursei (vezi api/_lib/eodhd.js, isMarketOpenNow/lastCompletedSessionClose).
    const allowOfficialClose = isWeeklyFinalWindow(now);
    const quoteBySymbol = new Map(priceQuotes.map((quote) => [quote.providerSymbol, quote]));
    const positionOutcomes = positions.map((position) => {
      const portfolio = portfolioById.get(position.portfolio_id);
      const quote = quoteBySymbol.get(position.provider_symbol);
      if (!quote || !isPositiveFinite(quote.price)) return { position, portfolio, status: 'invalid_price' };
      const freshness = classifyQuoteFreshness(quote.providerTimestamp, now, {
        providerSymbol: position.provider_symbol
      });
      return { position, portfolio, quote, status: freshness === 'fresh' ? 'ok' : freshness };
    });

    const fxQuoteByPair = new Map(fxQuotes.map((quote) => [`${quote.baseCurrency}_${quote.quoteCurrency}`, quote]));
    const fxOutcomes = requestPlan.fxPairs.map((pair) => {
      const quote = fxQuoteByPair.get(`${pair.base}_${pair.quote}`);
      if (!quote || !isPositiveFinite(quote.rate)) return { pair, status: 'invalid_rate' };
      const freshness = classifyQuoteFreshness(quote.providerTimestamp, now, {
        providerSymbol: `${pair.base}${pair.quote}.FOREX`
      });
      return { pair, quote, status: freshness === 'fresh' ? 'ok' : freshness };
    });

    const problems = [
      ...positionOutcomes.filter((outcome) => outcome.status !== 'ok').map((outcome) => ({
        ticker: outcome.position.ticker,
        portfolio: outcome.portfolio ? outcome.portfolio.code : null,
        status: outcome.status
      })),
      ...fxOutcomes.filter((outcome) => outcome.status !== 'ok').map((outcome) => ({
        ticker: `${outcome.pair.base}/${outcome.pair.quote}`,
        portfolio: null,
        status: `fx_${outcome.status}`
      }))
    ];
    if (problems.length) {
      await logSyncRun(admin, {
        runId, applied: false, reason: 'partial', problems,
        providerCallUnits: requestPlan.providerCallUnits,
        providerSymbolsRequested: requestPlan.providerCallUnits,
        quotaLimit: quota.limit, quotaProjected: quota.projected
      });
      return res.status(200).json({ success: true, applied: false, reason: 'partial', problems });
    }

    stage = 'apply_prices';
    const newFxRows = fxOutcomes.map((outcome) => ({
      base_currency: outcome.pair.base,
      quote_currency: outcome.pair.quote,
      rate: Number(outcome.quote.rate),
      as_of_date: outcome.quote.providerTimestamp.slice(0, 10),
      provider_fetched_at: outcome.quote.providerTimestamp
    }));
    const { convert, convertAsOf } = createFxConverter([...newFxRows, ...existingFxRows]);
    const normalizedPriceByPositionId = new Map(positionOutcomes.map((outcome) => [
      outcome.position.id,
      Number(outcome.quote.price) * Number(outcome.position.provider_price_multiplier)
    ]));

    stage = 'history';
    const valuationProblems = [];
    const performanceRows = portfolios.map((portfolio) => {
      const portfolioPositions = positionOutcomes.filter((outcome) => outcome.position.portfolio_id === portfolio.id);
      let holdings = 0;
      for (const outcome of portfolioPositions) {
        const price = normalizedPriceByPositionId.get(outcome.position.id);
        const quantity = Number(outcome.position.quantity);
        const converted = convert(quantity * price, outcome.position.instrument_currency, portfolio.base_currency);
        if (!Number.isFinite(converted)) {
          valuationProblems.push({ ticker: outcome.position.ticker, portfolio: portfolio.code, status: 'valuation_incomplete' });
        } else {
          holdings += converted;
        }
      }
      const ledgerCash = computeLedgerCashBaseCcy(transactions, dividends, portfolio.id, portfolio.base_currency, convert);
      const netContributed = computeNetCapitalContributedBaseCcy(transactions, portfolio.id, portfolio.base_currency, convertAsOf);
      if (!ledgerCash.complete || !Number.isFinite(ledgerCash.value)) {
        valuationProblems.push({ ticker: null, portfolio: portfolio.code, status: 'cash_conversion_incomplete' });
      }
      if (!netContributed.complete || !isPositiveFinite(netContributed.value)) {
        valuationProblems.push({ ticker: null, portfolio: portfolio.code, status: 'historical_fx_incomplete' });
      }
      const nav = holdings + ledgerCash.value;
      if (!isNonNegativeFinite(nav)) valuationProblems.push({ ticker: null, portfolio: portfolio.code, status: 'nav_incomplete' });
      const returnIsPending = hasPostFoundingCashFlow(transactions, portfolio.id, portfolio.founded_date);
      const cumulativeReturnPct = returnIsPending ? null : ((nav / netContributed.value) - 1) * 100;
      if (!returnIsPending && !Number.isFinite(cumulativeReturnPct)) {
        valuationProblems.push({ ticker: null, portfolio: portfolio.code, status: 'return_incomplete' });
      }
      return {
        portfolio_id: portfolio.id,
        portfolio_code: portfolio.code,
        as_of_date: todayIso,
        nav_value: nav,
        capital_contributed: netContributed.value,
        cumulative_return_pct: cumulativeReturnPct,
        return_is_pending: returnIsPending,
        currency: portfolio.base_currency
      };
    });

    const performanceContractError = validatePerformanceRowsContract(performanceRows);
    if (performanceContractError) {
      valuationProblems.push({ ticker: null, portfolio: null, status: performanceContractError });
    }

    if (valuationProblems.length) {
      await logSyncRun(admin, {
        runId, applied: false, reason: 'partial', problems: valuationProblems,
        providerCallUnits: requestPlan.providerCallUnits,
        providerSymbolsRequested: requestPlan.providerCallUnits,
        quotaLimit: quota.limit, quotaProjected: quota.projected
      });
      return res.status(200).json({ success: true, applied: false, reason: 'partial', problems: valuationProblems });
    }

    stage = 'snapshot';
    const payload = {
      run_id: runId,
      snapshot_kind: allowOfficialClose ? 'weekly_final' : 'intraday',
      evaluation_basis: evaluationBasis,
      positions: positionOutcomes.map((outcome) => ({
        position_id: outcome.position.id,
        price: normalizedPriceByPositionId.get(outcome.position.id),
        provider_timestamp: outcome.quote.providerTimestamp,
        price_source: 'delayed_feed'
      })),
      fx_rates: newFxRows,
      performance_rows: performanceRows,
      quota: {
        provider_call_units: requestPlan.providerCallUnits,
        provider_symbols_requested: requestPlan.providerCallUnits,
        quota_limit: quota.limit,
        quota_projected: quota.projected
      }
    };

    const { data: rpcResult, error: rpcError } = await admin.rpc('apply_portfolio_price_snapshot', { payload });
    if (rpcError) throw new Error('snapshot_commit_failed');
    if (rpcResult && rpcResult.applied === false) {
      return res.status(200).json({ success: true, applied: false, reason: rpcResult.reason || 'state_changed' });
    }
    return res.status(200).json({
      success: true,
      applied: true,
      positionsUpdated: rpcResult ? rpcResult.positions_updated : 0,
      snapshotKind: payload.snapshot_kind,
      quota
    });
  } catch (error) {
    if (leaseAcquired) {
      await logSyncRun(admin, {
        runId, applied: false, reason: 'server_error', problems: [],
        providerCallUnits: attemptedProviderCallUnits,
        providerSymbolsRequested: attemptedProviderSymbols,
        quotaLimit: auditQuotaLimit,
        quotaProjected: auditQuotaProjected
      });
    }
    // Doar eticheta etapei + numele constructorului erorii - niciodata
    // error.message/stack (pot contine detalii de la Supabase/DB), token,
    // URL sau body.
    console.error('[portfolio-sync] run failed', { stage, errorName: (error && error.name) || 'Unknown' });
    return res.status(500).json({ error: 'Server error' });
  } finally {
    if (leaseAcquired) {
      try {
        await releaseSyncLease(admin, runId);
      } catch (_) {
        // TTL-ul elibereaza lease-ul chiar daca release-ul explicit esueaza.
        console.error('[portfolio-sync] lease release failed');
      }
    }
  }
}

}

export default createSyncHandler();
