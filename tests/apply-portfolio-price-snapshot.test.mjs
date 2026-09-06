// Integrare optionala, exclusiv pe Supabase de TEST. Necesita opt-in explicit
// deoarece happy path scrie audit + performance row pentru TEST_SNAPSHOT_AS_OF_DATE.

import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { buildEvaluationBasis } from '../api/cron/sync-portfolio-prices.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const asOfDate = process.env.TEST_SNAPSHOT_AS_OF_DATE;
const writeEnabled = process.env.ALLOW_SUPABASE_WRITE_TESTS === '1';

export function assertStateChangedRaceResult(result, audit, runId) {
  if (result.error !== null) throw new Error('race RPC a esuat cu eroare SQL in loc de state_changed');
  if (result.data?.applied !== false || result.data?.reason !== 'state_changed' || result.data?.run_id !== runId) {
    throw new Error('race RPC nu a returnat state_changed pentru acelasi run_id');
  }
  if (audit.error !== null || audit.data?.id !== runId || audit.data?.applied !== false || audit.data?.reason !== 'state_changed') {
    throw new Error('auditul atomic state_changed lipseste sau apartine altui run');
  }
}

function selfTestRaceAssertionHelper() {
  const runId = '00000000-0000-4000-8000-000000000099';
  const validResult = { error: null, data: { applied: false, reason: 'state_changed', run_id: runId } };
  const validAudit = { error: null, data: { id: runId, applied: false, reason: 'state_changed' } };
  assert.doesNotThrow(() => assertStateChangedRaceResult(validResult, validAudit, runId));
  for (const falsePositive of [
    [{ error: { message: 'unrelated SQL error' }, data: null }, validAudit],
    [{ error: null, data: { applied: true, reason: 'ok', run_id: runId } }, validAudit],
    [{ error: null, data: { applied: false, reason: 'locked', run_id: runId } }, validAudit],
    [{ error: null, data: { applied: false, reason: 'state_changed', run_id: 'other-run' } }, validAudit],
    [validResult, { error: null, data: null }],
    [validResult, { error: null, data: { id: runId, applied: false, reason: 'server_error' } }]
  ]) {
    assert.throws(() => assertStateChangedRaceResult(falsePositive[0], falsePositive[1], runId));
  }
  console.log('[PASS] race assertion helper respinge false-positive SQL/reason/run/audit');
}

async function main() {
  selfTestRaceAssertionHelper();
  if (!url || !key || !asOfDate || !writeEnabled) {
    console.log('[SKIP] teste RPC snapshot -- necesita Supabase TEST + TEST_SNAPSHOT_AS_OF_DATE + ALLOW_SUPABASE_WRITE_TESTS=1');
    return;
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [portfolioResult, positionResult, txResult, divResult, fxResult] = await Promise.all([
    admin.from('portfolios').select('id,code,base_currency,founded_date').in('code', ['US', 'EU']),
    admin.from('portfolio_positions').select('id,portfolio_id,active,instrument_currency,quantity,avg_price,current_price,price_updated_at,price_source,provider_symbol,provider_price_multiplier').eq('active', true),
    admin.from('portfolio_transactions').select('id,portfolio_id,type,quantity,price,amount,fee_amount,currency,executed_at'),
    admin.from('portfolio_dividends').select('id,portfolio_id,amount,currency'),
    admin.from('fx_rates').select('id,base_currency,quote_currency,rate,as_of_date,source,provider_fetched_at')
  ]);
  for (const result of [portfolioResult, positionResult, txResult, divResult, fxResult]) {
    if (result.error) throw result.error;
  }
  const portfolios = portfolioResult.data || [];
  const positions = positionResult.data || [];
  const transactions = txResult.data || [];
  const dividends = divResult.data || [];
  const fxRates = fxResult.data || [];
  if (portfolios.length !== 2 || !positions.length) throw new Error('fixture US/EU incomplet');

  async function refreshBasisState() {
    const [positionRefresh, fxRefresh] = await Promise.all([
      admin.from('portfolio_positions').select('id,portfolio_id,active,instrument_currency,quantity,avg_price,current_price,price_updated_at,price_source,provider_symbol,provider_price_multiplier').eq('active', true),
      admin.from('fx_rates').select('id,base_currency,quote_currency,rate,as_of_date,source,provider_fetched_at')
    ]);
    if (positionRefresh.error || fxRefresh.error) throw positionRefresh.error || fxRefresh.error;
    positions.splice(0, positions.length, ...(positionRefresh.data || []));
    fxRates.splice(0, fxRates.length, ...(fxRefresh.data || []));
  }

  function makePayload(runId) {
    const now = new Date().toISOString();
    return {
      run_id: runId,
      snapshot_kind: 'intraday',
      evaluation_basis: buildEvaluationBasis(portfolios, positions, transactions, dividends, fxRates),
      positions: positions.map((row) => ({
        position_id: row.id,
        price: Number(row.current_price) > 0 ? Number(row.current_price) : 1,
        provider_timestamp: row.price_updated_at && row.price_updated_at > now ? row.price_updated_at : now,
        price_source: 'delayed_feed'
      })),
      fx_rates: [],
      performance_rows: portfolios.map((row) => ({
        portfolio_id: row.id,
        portfolio_code: row.code,
        as_of_date: asOfDate,
        nav_value: 1,
        capital_contributed: 1,
        cumulative_return_pct: 0,
        return_is_pending: false,
        currency: row.base_currency
      })),
      quota: { provider_call_units: 0, provider_symbols_requested: 0, quota_limit: 1, quota_projected: 0 }
    };
  }

  async function acquire(runId) {
    const result = await admin.rpc('acquire_portfolio_sync_lease', { p_owner: runId, p_ttl_seconds: 60 });
    if (result.error || !result.data?.acquired) throw new Error('lease indisponibil');
  }

  async function release(runId) {
    await admin.rpc('release_portfolio_sync_lease', { p_owner: runId });
  }

  // Happy path + audit in aceeasi tranzactie.
  {
    const runId = randomUUID();
    await acquire(runId);
    try {
      const result = await admin.rpc('apply_portfolio_price_snapshot', { payload: makePayload(runId) });
      if (result.error || !result.data?.applied) throw new Error('happy path respins: ' + (result.error?.message || 'unknown'));
      const audit = await admin.from('portfolio_sync_runs').select('id,applied,reason').eq('id', runId).single();
      if (audit.error || !audit.data?.applied || audit.data.reason !== 'ok') throw new Error('audit atomic lipsa');
      console.log('[PASS] happy path + audit atomic');
      await refreshBasisState();
    } finally {
      await release(runId);
    }
  }

  async function expectInvalidBatch(name, mutate) {
    const runId = randomUUID();
    await acquire(runId);
    try {
      const payload = makePayload(runId);
      await mutate(payload);
      const result = await admin.rpc('apply_portfolio_price_snapshot', { payload });
      if (!result.error) throw new Error(`${name}: batch invalid nu a produs eroarea de validare asteptata`);
      console.log(`[PASS] ${name}`);
    } finally {
      await release(runId);
    }
  }

  async function expectStateChangedRace(name, mutate) {
    const runId = randomUUID();
    await acquire(runId);
    try {
      const payload = makePayload(runId);
      await mutate(payload);
      const result = await admin.rpc('apply_portfolio_price_snapshot', { payload });
      const audit = await admin.from('portfolio_sync_runs').select('id,applied,reason').eq('id', runId).single();
      assertStateChangedRaceResult(result, audit, runId);
      console.log(`[PASS] ${name}`);
    } finally {
      await release(runId);
    }
  }

  await expectInvalidBatch('performance_rows 1', async (payload) => { payload.performance_rows.pop(); });
  await expectInvalidBatch('active-position mismatch', async (payload) => { payload.positions.pop(); });
  await expectInvalidBatch('FX rate 0', async (payload) => {
    payload.fx_rates.push({ base_currency: 'USD', quote_currency: 'GBP', rate: 0, as_of_date: asOfDate, provider_fetched_at: new Date().toISOString() });
  });

  // Race real: basis citita, admin schimba quantity, RPC trebuie sa respinga,
  // apoi fixture-ul este restaurat in finally.
  {
    const target = positions[0];
    const originalQuantity = target.quantity;
    await expectStateChangedRace('stale evaluation fingerprint dupa admin quantity PATCH', async () => {
      const changed = await admin.from('portfolio_positions').update({ quantity: Number(originalQuantity) + 1 }).eq('id', target.id);
      if (changed.error) throw changed.error;
    }).finally(async () => {
      await admin.from('portfolio_positions').update({ quantity: originalQuantity }).eq('id', target.id);
    });
  }

  // Timestamp egal trebuie sa scrie acelasi pret folosit in performance_rows,
  // nu sa pastreze un current_price diferit din DB.
  {
    const target = positions.find((row) => row.price_updated_at && Number(row.current_price) > 0);
    if (!target) throw new Error('fixture fara position current_price + price_updated_at pentru equal-timestamp test');
    const runId = randomUUID();
    const original = {
      current_price: target.current_price,
      price_updated_at: target.price_updated_at,
      price_source: target.price_source
    };
    const correctedPrice = Number(target.current_price) + 0.123456;
    await acquire(runId);
    try {
      const payload = makePayload(runId);
      const row = payload.positions.find((item) => item.position_id === target.id);
      row.price = correctedPrice;
      row.provider_timestamp = target.price_updated_at;
      const result = await admin.rpc('apply_portfolio_price_snapshot', { payload });
      if (result.error || !result.data?.applied) throw new Error('equal timestamp batch respins');
      const stored = await admin.from('portfolio_positions').select('current_price,price_updated_at').eq('id', target.id).single();
      if (stored.error || Number(stored.data.current_price) !== correctedPrice) {
        throw new Error('equal timestamp a pastrat un current_price inconsistent');
      }
      console.log('[PASS] equal provider timestamp actualizeaza current_price consistent');
    } finally {
      await admin.from('portfolio_positions').update(original).eq('id', target.id);
      await release(runId);
      await refreshBasisState();
    }
  }

  if (!fxRates.length) throw new Error('fixture fara fx_rates pentru race tests');
  const targetFx = fxRates[0];
  const restoreFx = {
    id: targetFx.id,
    base_currency: targetFx.base_currency,
    quote_currency: targetFx.quote_currency,
    rate: targetFx.rate,
    as_of_date: targetFx.as_of_date,
    source: targetFx.source,
    provider_fetched_at: targetFx.provider_fetched_at
  };

  await expectStateChangedRace('stale evaluation fingerprint dupa FX update', async () => {
    const changed = await admin.from('fx_rates').update({ rate: Number(targetFx.rate) + 0.000001 }).eq('id', targetFx.id);
    if (changed.error) throw changed.error;
  }).finally(async () => {
    await admin.from('fx_rates').update({ rate: targetFx.rate }).eq('id', targetFx.id);
  });

  await expectStateChangedRace('stale evaluation fingerprint dupa FX delete', async () => {
    const deleted = await admin.from('fx_rates').delete().eq('id', targetFx.id);
    if (deleted.error) throw deleted.error;
  }).finally(async () => {
    const restored = await admin.from('fx_rates').insert(restoreFx);
    if (restored.error) throw restored.error;
  });

  const phantom = {
    id: randomUUID(), base_currency: 'GBP', quote_currency: 'EUR', rate: 1,
    as_of_date: '1900-02-03', source: 'manual', provider_fetched_at: null
  };
  await expectStateChangedRace('stale evaluation fingerprint dupa FX insert phantom', async () => {
    const inserted = await admin.from('fx_rates').insert(phantom);
    if (inserted.error) throw inserted.error;
  }).finally(async () => {
    await admin.from('fx_rates').delete().eq('id', phantom.id);
  });
}

main().catch((error) => {
  console.error('[FAIL] teste RPC snapshot:', error);
  process.exit(1);
});
