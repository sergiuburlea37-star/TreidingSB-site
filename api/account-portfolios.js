// api/account-portfolios.js
// Returneaza portofoliile (US/EU) cu pozitii, tranzactii recente, dividende si
// istoric de performanta - doar pentru membri cu abonament activ (sau admin).
// Aceleasi coduri de eroare si acelasi tipar ca api/account-ideas.js:
//   401 - fara sesiune valida
//   403 { requiresSubscription: true } - autentificat, dar fara abonament activ
//   200 { success: true, portfolios: [...] } - altfel
//
// Verificarea accesului foloseste exclusiv getAccessInfo() (api/_lib/access.js),
// neschimbat: sesiune valida + rol + subscriptions.status==='active' +
// subscriptions.expires_at > now(). Clientul folosit pentru citire e legat de
// tokenul userului (access.client), deci RLS din Postgres se aplica oricum ca
// ultim strat de siguranta, chiar daca ar exista un bug mai sus in acest fisier.
//
// Nu contine si nu poate contine cheia service_role - vezi api/_lib/supabase.js:
// access.client foloseste doar anon key + Authorization: Bearer <tokenul userului>.

import { getAccessInfo } from './_lib/access.js';

const RECENT_TRANSACTIONS_LIMIT = 15;
const RECENT_DIVIDENDS_LIMIT = 15;
const DELAYED_DATA_MINUTES = 15;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const access = await getAccessInfo(token);
  if (!access.authenticated) {
    return res.status(401).json({ error: 'Sesiune invalida sau expirata' });
  }
  if (!access.isAdmin && !access.hasActiveSub) {
    return res.status(403).json({ error: 'Necesita abonament activ', requiresSubscription: true });
  }

  try {
    const { data: portfolios, error: pErr } = await access.client
      .from('portfolios')
      .select('id, code, name, base_currency, founded_date, initial_capital, target_return_text, risk_level, description')
      .order('code', { ascending: true });
    if (pErr) return res.status(500).json({ error: 'Server error: ' + pErr.message });

    const ids = (portfolios || []).map((p) => p.id);
    if (!ids.length) {
      return res.status(200).json({ success: true, portfolios: [], delayedDataMinutes: DELAYED_DATA_MINUTES });
    }

    const [positionsRes, txRes, divRes, perfRes, fxRes] = await Promise.all([
      access.client
        .from('portfolio_positions')
        .select('id, portfolio_id, position_no, ticker, name, category, sector_or_market, instrument_currency, quantity, avg_price, current_price, price_updated_at, price_source, risk_level, group_label, active, sort_order')
        .in('portfolio_id', ids)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      access.client
        .from('portfolio_transactions')
        .select('id, portfolio_id, position_id, ticker, type, quantity, price, amount, fee_amount, currency, executed_at, note')
        .in('portfolio_id', ids)
        .order('executed_at', { ascending: false })
        .limit(RECENT_TRANSACTIONS_LIMIT * ids.length),
      access.client
        .from('portfolio_dividends')
        .select('id, portfolio_id, position_id, ticker, amount, currency, ex_date, pay_date, note')
        .in('portfolio_id', ids)
        .order('pay_date', { ascending: false })
        .limit(RECENT_DIVIDENDS_LIMIT * ids.length),
      access.client
        .from('portfolio_performance_history')
        .select('portfolio_id, as_of_date, nav_value, capital_contributed, cumulative_return_pct, currency')
        .in('portfolio_id', ids)
        .order('as_of_date', { ascending: true }),
      access.client
        .from('fx_rates')
        .select('base_currency, quote_currency, rate, as_of_date')
        .order('as_of_date', { ascending: false })
    ]);

    if (positionsRes.error) return res.status(500).json({ error: 'Server error: ' + positionsRes.error.message });
    if (txRes.error) return res.status(500).json({ error: 'Server error: ' + txRes.error.message });
    if (divRes.error) return res.status(500).json({ error: 'Server error: ' + divRes.error.message });
    if (perfRes.error) return res.status(500).json({ error: 'Server error: ' + perfRes.error.message });
    if (fxRes.error) return res.status(500).json({ error: 'Server error: ' + fxRes.error.message });

    // Cel mai recent curs disponibil per pereche valutara (fx_rates e mic, se
    // poate reduce in memorie fara alt query).
    const latestFx = {};
    (fxRes.data || []).forEach((r) => {
      const key = r.base_currency + '_' + r.quote_currency;
      if (!latestFx[key]) latestFx[key] = r; // primul intalnit e cel mai recent (sortat desc)
    });
    function convert(amount, from, to) {
      if (from === to) return amount;
      const direct = latestFx[from + '_' + to];
      if (direct) return amount * direct.rate;
      const inverse = latestFx[to + '_' + from];
      if (inverse && inverse.rate) return amount / inverse.rate;
      return null; // fara curs disponibil - UI trebuie sa afiseze explicit "curs indisponibil", nu 0 sau o valoare inventata
    }

    const result = (portfolios || []).map((p) => {
      const positions = (positionsRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .map((x) => {
          const marketValueInstrumentCcy = x.current_price != null ? x.quantity * x.current_price : null;
          const marketValueBaseCcy = marketValueInstrumentCcy != null
            ? convert(marketValueInstrumentCcy, x.instrument_currency, p.base_currency)
            : null;
          const costBasis = x.quantity * x.avg_price;
          const plInstrumentCcy = marketValueInstrumentCcy != null ? marketValueInstrumentCcy - costBasis : null;
          return {
            ticker: x.ticker,
            name: x.name,
            category: x.category,
            sectorOrMarket: x.sector_or_market,
            instrumentCurrency: x.instrument_currency,
            quantity: x.quantity,
            avgPrice: x.avg_price,
            currentPrice: x.current_price,
            priceUpdatedAt: x.price_updated_at,
            priceSource: x.price_source,
            riskLevel: x.risk_level,
            groupLabel: x.group_label,
            marketValueInstrumentCcy,
            marketValueBaseCcy,
            plInstrumentCcy,
            plPct: costBasis ? (plInstrumentCcy / costBasis) * 100 : null
          };
        });

      const totalMarketValueBaseCcy = positions.reduce((sum, x) => sum + (x.marketValueBaseCcy || 0), 0);
      const totalWithKnownValue = positions.filter((x) => x.marketValueBaseCcy != null).length;

      const transactions = (txRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .slice(0, RECENT_TRANSACTIONS_LIMIT)
        .map((x) => ({
          type: x.type, ticker: x.ticker, quantity: x.quantity, price: x.price,
          amount: x.amount, feeAmount: x.fee_amount, currency: x.currency,
          executedAt: x.executed_at, note: x.note
        }));

      const dividends = (divRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .slice(0, RECENT_DIVIDENDS_LIMIT)
        .map((x) => ({
          ticker: x.ticker, amount: x.amount, currency: x.currency,
          exDate: x.ex_date, payDate: x.pay_date, note: x.note
        }));

      const performanceHistory = (perfRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .map((x) => ({
          asOfDate: x.as_of_date, navValue: x.nav_value,
          capitalContributed: x.capital_contributed,
          cumulativeReturnPct: x.cumulative_return_pct, currency: x.currency
        }));

      const lastPriceUpdate = positions.reduce((latest, x) => {
        if (!x.priceUpdatedAt) return latest;
        return !latest || x.priceUpdatedAt > latest ? x.priceUpdatedAt : latest;
      }, null);

      const latestPerf = performanceHistory.length ? performanceHistory[performanceHistory.length - 1] : null;

      return {
        code: p.code,
        name: p.name,
        baseCurrency: p.base_currency,
        foundedDate: p.founded_date,
        initialCapital: p.initial_capital,
        targetReturnText: p.target_return_text,
        riskLevel: p.risk_level,
        description: p.description,
        currentValueBaseCcy: totalWithKnownValue ? totalMarketValueBaseCcy : null,
        profitSinceFoundedBaseCcy: (totalWithKnownValue && p.initial_capital != null)
          ? totalMarketValueBaseCcy - p.initial_capital : null,
        totalReturnPct: latestPerf ? latestPerf.cumulativeReturnPct : null,
        positions,
        transactions,
        dividends,
        performanceHistory,
        lastUpdatedAt: lastPriceUpdate
      };
    });

    return res.status(200).json({
      success: true,
      portfolios: result,
      // Sistemul e proiectat pentru date intarziate ~15 minute (Etapa 4) -
      // nicio integrare live nu e activa inca (vezi price_source = 'manual').
      delayedDataMinutes: DELAYED_DATA_MINUTES
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
