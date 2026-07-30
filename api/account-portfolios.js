// api/account-portfolios.js
// Returneaza portofoliile (US/EU) cu pozitii, tranzactii recente, dividende si
// istoric de performanta - doar pentru membri cu abonament activ (sau admin).
// Aceleasi coduri de eroare si acelasi tipar ca api/account-ideas.js:
//   401 - fara sesiune valida (token lipsa, invalid, expirat sau malformat)
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
//
// Nota (2026-07-29): getAccessInfo() poate arunca o exceptie in loc sa
// returneze { authenticated: false } atunci cand tokenul e sintactic invalid
// / malformat (nu doar "lipsa" sau "expirat curat") - comportament mostenit
// din libraria Supabase Auth la decodarea unui JWT care nu e nici macar
// structurat corect. Fara try/catch in jurul apelului, exceptia respectiva
// ajunge neprinsa la runtime-ul Vercel si rezulta intr-un 500 generic
// (FUNCTION_INVOCATION_FAILED), nu intr-un 401 curat. Acelasi comportament
// exista si in api/account-ideas.js, api/auth-me.js, api/subscription-status.js
// (toate folosesc getAccessInfo() neprotejat) - NU a fost modificat aici,
// fiind in afara scopului acestui PR (necesita aprobare separata inainte de
// a atinge cod folosit de rute existente). Fixul de mai jos e strict local
// acestui endpoint nou: orice eroare la rezolvarea accesului (token lipsa,
// invalid, expirat sau malformat) e tratata uniform ca "sesiune invalida",
// cu un mesaj generic - fara sa expuna cauza interna (Supabase/JWT/stack).
//
// Nota (2026-07-30, v2): ponderile (weightPct) NU mai sunt calculate
// client-side. Bug-ul raportat initial ("57,1% / 42,9%") venea din client
// (script.js) care (a) trata o valoare de piata neconvertibila
// (marketValueBaseCcy == null, din lipsa unui curs in fx_rates) ca 0 in loc
// sa o excluda/marcheze, si (b) folosea ca numitor doar suma pozitiilor cu
// pret, ignorand cash-ul din portfolio_cash_reserves.
//
// Nota (2026-07-30, v3 - schimbare de directie ceruta explicit de user):
// Pana cand un furnizor de preturi live e integrat, endpoint-ul NU mai
// expune o "pondere curenta" bazata pe pret/curs de piata (currentWeightPct
// e calculat mai jos strict pentru uz intern/admin, UI-ul membrilor NU
// trebuie sa il afiseze - vezi member-portfolios.js). In loc, UI-ul afiseaza
// "Pondere initiala" (initialWeightPct): suma tranzactiilor BUY ale
// pozitiei, convertita in moneda de baza a portofoliului, impartita la
// capitalul initial al portofoliului. Aceasta valoare e FIXA (istorica) -
// nu se schimba odata cu pretul curent sau cu cursul valutar de azi, decat
// daca admin corecteaza o tranzactie. Conversia foloseste acelasi convert()
// (cel mai recent curs din fx_rates) - dar, spre deosebire de pretul curent,
// BUY-urile din seed sunt toate din aceeasi fereastra de timp (fondare), deci
// o singura conversie per pereche valutara e suficienta si nu se recalculeaza
// des. initialWeightPct e null (nu 0, nu o valoare inventata) atunci cand fie
// nu exista nicio tranzactie BUY pentru pozitie, fie cursul de conversie
// necesar lipseste - vezi initialWeightDataComplete / initialWeightsComplete.
// Interogarea tranzactiilor BUY e SEPARATA de txRes (lista "tranzactii
// recente" afisata in UI, limitata la RECENT_TRANSACTIONS_LIMIT per
// portofoliu) - in mod deliberat, ca sa nu depinda de acea limita: daca
// numarul de tranzactii creste in timp, txRes ar putea sa nu mai contina
// BUY-urile initiale (cele mai vechi), ceea ce ar corupe tacit calculul
// ponderii initiale.
//
// Pretul curent / profitul curent / pondere curenta (bazate pe current_price)
// raman calculate mai jos (currentPrice, isReferencePrice, marketValueBaseCcy,
// plInstrumentCcy, plPct, currentWeightPct, currentValueBaseCcy,
// profitSinceFoundedBaseCcy, totalReturnPct) - utile pentru admin si pentru
// etapa 4 (integrare furnizor live) - dar member-portfolios.js NU trebuie sa
// le afiseze ca valori "curente" catre membri cat timp price_source ramane
// 'manual' pe toate pozitiile; UI-ul trebuie sa afiseze explicit "In asteptarea
// datelor live" in loc, vezi campul priceSource / isReferencePrice.
//
// Nota (2026-07-30, hotfix): convert() stia doar sa caute un curs DIRECT
// (from_to) sau un singur nivel de curs INVERS (to_from) - nimic altceva.
// Pozitiile US in USD (IWDA, EIMI, WSML, AAPL - vezi seed v5, instrument_currency
// = 'USD' desi portofoliul US e in GBP) nu aveau niciun curs direct sau invers
// USD/GBP in fx_rates (seed-ul din 2026-07-30 a introdus doar perechi EUR/*),
// deci convert() returna null si UI-ul afisa "curs indisponibil" pentru toate
// cele 4 pozitii. Adaugat mai jos: triangulare printr-o moneda-punte (EUR),
// ca fallback STRICT dupa ce cursul direct/invers lipseste - foloseste doar
// cursuri EUR/X si EUR/Y deja existente in fx_rates, din ACEEASI as_of_date
// (nu combina niciodata doua date diferite intr-un curs derivat - vezi
// convertViaBridge). Nu introduce niciun curs nou si nu aproximeaza nimic:
// e strict aritmetica pe cursuri reale deja introduse (EUR/USD, EUR/GBP etc).
//
// Limitare cunoscuta, NEREZOLVATA de acest fallback: fx_rates contine in
// acest moment DOAR cursuri datate 2026-05-18 (data fondarii portofoliului
// EU). Portofoliul US insa a fost fondat la 2026-05-07 - o data pentru care
// NU exista niciun curs EUR/USD sau EUR/GBP in fx_rates. Triangularea de mai
// jos tot foloseste cursurile din 2026-05-18 (cea mai recenta/singura data
// disponibila), pentru ca altfel pozitiile USD din US ar ramane permanent
// "curs indisponibil" - dar rezultatul e un curs real DECALAT cu 11 zile
// fata de data tranzactiilor BUY ale portofoliului US, deci ponderile
// rezultate pt. IWDA/EIMI/WSML/AAPL vor fi apropiate, dar NU identice cu
// ponderile-tinta (25% / 10% / 7% / 7.5%) validate anterior - vezi raportul
// hotfix-ului pentru cifrele exacte. Rezolvarea completa necesita cursuri
// ECB reale pentru 2026-05-07, sursate si aprobate separat (acelasi tipar ca
// seed-ul 202607300006) - NU a fost facuta aici, ca sa nu se inventeze un
// curs istoric.

import { getAccessInfo } from './_lib/access.js';

const RECENT_TRANSACTIONS_LIMIT = 15;
const RECENT_DIVIDENDS_LIMIT = 15;
const DELAYED_DATA_MINUTES = 15;
const INVALID_SESSION_RESPONSE = { error: 'Sesiune invalida sau expirata' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let access;
  try {
    access = await getAccessInfo(token);
  } catch (err) {
    // Token malformat / expirat intr-un mod care face libraria Supabase Auth
    // sa arunce in loc sa returneze o eroare "curata". Raspuns uniform 401,
    // fara detalii interne (nu includem err.message sau stack-ul aici).
    return res.status(401).json(INVALID_SESSION_RESPONSE);
  }

  if (!access || !access.authenticated) {
    return res.status(401).json(INVALID_SESSION_RESPONSE);
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

    const [positionsRes, txRes, buyTxRes, divRes, perfRes, fxRes, cashRes] = await Promise.all([
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
      // Toate tranzactiile BUY, NElimitate - sursa pentru "Pondere initiala".
      // Interogare separata de txRes (care e doar pt. lista "recente" afisata
      // in UI si e limitata) tocmai ca sa nu se piarda BUY-uri vechi daca
      // volumul de tranzactii creste.
      access.client
        .from('portfolio_transactions')
        .select('id, portfolio_id, position_id, amount, currency, executed_at')
        .in('portfolio_id', ids)
        .eq('type', 'BUY'),
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
        .order('as_of_date', { ascending: false }),
      access.client
        .from('portfolio_cash_reserves')
        .select('id, portfolio_id, category, amount, currency, reserved_for_ticker, status, note')
        .in('portfolio_id', ids)
        .eq('status', 'reserved')
        .order('category', { ascending: true })
    ]);

    if (positionsRes.error) return res.status(500).json({ error: 'Server error: ' + positionsRes.error.message });
    if (txRes.error) return res.status(500).json({ error: 'Server error: ' + txRes.error.message });
    if (buyTxRes.error) return res.status(500).json({ error: 'Server error: ' + buyTxRes.error.message });
    if (divRes.error) return res.status(500).json({ error: 'Server error: ' + divRes.error.message });
    if (perfRes.error) return res.status(500).json({ error: 'Server error: ' + perfRes.error.message });
    if (fxRes.error) return res.status(500).json({ error: 'Server error: ' + fxRes.error.message });
    if (cashRes.error) return res.status(500).json({ error: 'Server error: ' + cashRes.error.message });

    // Cel mai recent curs disponibil per pereche valutara (fx_rates e mic, se
    // poate reduce in memorie fara alt query).
    const latestFx = {};
    (fxRes.data || []).forEach((r) => {
      const key = r.base_currency + '_' + r.quote_currency;
      if (!latestFx[key]) latestFx[key] = r; // primul intalnit e cel mai recent (sortat desc)
    });

    // Cursuri indexate si pe as_of_date (separat de latestFx) - necesar
    // STRICT pentru triangulare (bridging printr-o moneda terta), ca sa nu
    // se combine niciodata un curs EUR/X de la o data cu un curs EUR/Y de la
    // alta data intr-un curs derivat artificial. Vezi convertViaBridge.
    const fxByDate = {}; // as_of_date -> { 'BASE_QUOTE': rate }
    (fxRes.data || []).forEach((r) => {
      const d = r.as_of_date;
      if (!fxByDate[d]) fxByDate[d] = {};
      const key = r.base_currency + '_' + r.quote_currency;
      if (!(key in fxByDate[d])) fxByDate[d][key] = r.rate; // un singur curs per pereche/data (unique constraint din schema)
    });
    const fxDatesDesc = Object.keys(fxByDate).sort().reverse(); // cea mai recenta data intai

    function rateOnDate(from, to, ratesForDate) {
      const direct = ratesForDate[from + '_' + to];
      if (direct != null) return direct;
      const inverse = ratesForDate[to + '_' + from];
      if (inverse) return 1 / inverse;
      return null;
    }

    // Triangulare printr-o moneda-punte (implicit EUR): amount (in "from")
    // -> punte -> "to", folosind DOAR cele doua curse punte->from si
    // punte->to citite din ACEEASI as_of_date. Incearca datele disponibile
    // de la cea mai recenta la cea mai veche, foloseste prima data la care
    // ambele curse exista. Nu aproximeaza si nu introduce niciun curs nou -
    // e strict aritmetica pe curs deja existent in fx_rates.
    function convertViaBridge(amount, from, to, bridge) {
      for (const d of fxDatesDesc) {
        const ratesForDate = fxByDate[d];
        const bridgeToFrom = rateOnDate(bridge, from, ratesForDate); // 1 bridge = bridgeToFrom * from
        const bridgeToTo = rateOnDate(bridge, to, ratesForDate);     // 1 bridge = bridgeToTo * to
        if (bridgeToFrom != null && bridgeToTo != null) {
          return (amount / bridgeToFrom) * bridgeToTo;
        }
      }
      return null;
    }

    function convert(amount, from, to) {
      if (from === to) return amount;
      const direct = latestFx[from + '_' + to];
      if (direct) return amount * direct.rate;
      const inverse = latestFx[to + '_' + from];
      if (inverse && inverse.rate) return amount / inverse.rate;
      // Fallback: triangulare prin EUR, doar daca nu exista curs direct/invers.
      // Ex.: USD -> GBP = (EUR/GBP) / (EUR/USD), cand fx_rates nu are nicio
      // pereche USD/GBP sau GBP/USD directa (cazul pozitiilor US in USD).
      const viaEur = convertViaBridge(amount, from, to, 'EUR');
      if (viaEur != null) return viaEur;
      return null; // fara curs disponibil (nici direct, nici invers, nici prin triangulare) - UI trebuie sa afiseze explicit "curs indisponibil", nu 0 sau o valoare inventata
    }

    const result = (portfolios || []).map((p) => {
      const buysForPortfolio = (buyTxRes.data || []).filter((t) => t.portfolio_id === p.id);

      const positionsRaw = (positionsRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .map((x) => {
          const marketValueInstrumentCcy = x.current_price != null ? x.quantity * x.current_price : null;
          const marketValueBaseCcy = marketValueInstrumentCcy != null
            ? convert(marketValueInstrumentCcy, x.instrument_currency, p.base_currency)
            : null;
          const costBasis = x.quantity * x.avg_price;
          const plInstrumentCcy = marketValueInstrumentCcy != null ? marketValueInstrumentCcy - costBasis : null;
          const isReferencePrice = x.current_price != null && x.current_price === x.avg_price;

          // Pondere initiala: suma tranzactiilor BUY ale acestei pozitii,
          // convertita in moneda de baza a portofoliului. null (nu 0) daca
          // nu exista nicio tranzactie BUY sau daca lipseste cursul necesar.
          const buysForPosition = buysForPortfolio.filter((t) => t.position_id === x.id);
          const convertedBuyAmounts = buysForPosition.map((t) => convert(t.amount, t.currency, p.base_currency));
          const initialWeightDataComplete = buysForPosition.length > 0 && convertedBuyAmounts.every((v) => v != null);
          const initialBuySumBaseCcy = initialWeightDataComplete
            ? convertedBuyAmounts.reduce((sum, v) => sum + v, 0)
            : null;

          return {
            ticker: x.ticker,
            name: x.name,
            category: x.category,
            sectorOrMarket: x.sector_or_market,
            instrumentCurrency: x.instrument_currency,
            quantity: x.quantity,
            avgPrice: x.avg_price,
            currentPrice: x.current_price,
            // true cand pretul curent afisat e de fapt pretul mediu de achizitie
            // (nicio integrare de piata live inca - vezi price_source = 'manual').
            // UI-ul trebuie sa afiseze "In asteptarea datelor live" cat timp
            // priceSource !== 'live_feed', NICIODATA acest pret ca fiind live.
            isReferencePrice,
            priceUpdatedAt: x.price_updated_at,
            priceSource: x.price_source,
            riskLevel: x.risk_level,
            groupLabel: x.group_label,
            marketValueInstrumentCcy,
            marketValueBaseCcy,
            plInstrumentCcy,
            plPct: costBasis ? (plInstrumentCcy / costBasis) * 100 : null,
            initialBuySumBaseCcy,
            initialWeightDataComplete
          };
        });

      const totalMarketValueBaseCcy = positionsRaw.reduce((sum, x) => sum + (x.marketValueBaseCcy || 0), 0);
      const totalWithKnownValue = positionsRaw.filter((x) => x.marketValueBaseCcy != null).length;
      const positionsDataComplete = positionsRaw.length === 0 || totalWithKnownValue === positionsRaw.length;
      const allPricesLive = positionsRaw.length > 0 && positionsRaw.every((x) => x.priceSource === 'live_feed');

      const cashReservesRaw = (cashRes.data || [])
        .filter((x) => x.portfolio_id === p.id)
        .map((x) => {
          const amountBaseCcy = convert(x.amount, x.currency, p.base_currency);
          return {
            category: x.category,
            amount: x.amount,
            currency: x.currency,
            amountBaseCcy,
            reservedForTicker: x.reserved_for_ticker,
            status: x.status,
            note: x.note
          };
        });
      const totalCashBaseCcy = cashReservesRaw.reduce((sum, x) => sum + (x.amountBaseCcy || 0), 0);
      const totalCashWithKnownValue = cashReservesRaw.filter((x) => x.amountBaseCcy != null).length;
      const cashDataComplete = cashReservesRaw.length === 0 || totalCashWithKnownValue === cashReservesRaw.length;

      // Numitorul ponderii CURENTE (uz intern/admin) = capitalul TOTAL al
      // portofoliului (pozitii cu valoare cunoscuta + cash cu valoare
      // cunoscuta), in moneda de baza. NU e folosit pentru pondere initiala
      // (acolo numitorul e intotdeauna capitalul initial - fix, istoric).
      const hasAnyKnownValue = totalWithKnownValue > 0 || totalCashWithKnownValue > 0;
      const totalCapitalBaseCcy = hasAnyKnownValue ? (totalMarketValueBaseCcy + totalCashBaseCcy) : null;
      const dataComplete = positionsDataComplete && cashDataComplete;

      const positions = positionsRaw.map((x) => ({
        ...x,
        // currentWeightPct: pondere bazata pe pretul curent (de fapt pretul
        // de referinta cat timp priceSource !== 'live_feed') - calculata
        // strict pt. uz intern/admin. member-portfolios.js NU trebuie sa
        // afiseze acest camp catre membri (vezi nota din antetul fisierului);
        // afiseaza in loc initialWeightPct.
        currentWeightPct: (x.marketValueBaseCcy != null && totalCapitalBaseCcy)
          ? (x.marketValueBaseCcy / totalCapitalBaseCcy) * 100
          : null,
        // initialWeightPct: suma BUY (in moneda de baza) / capitalul initial
        // al portofoliului * 100. Fixa (istorica) - nu depinde de pretul
        // curent. null (nu 0) daca initialWeightDataComplete e false.
        initialWeightPct: (x.initialBuySumBaseCcy != null && p.initial_capital)
          ? (x.initialBuySumBaseCcy / p.initial_capital) * 100
          : null
      }));

      const initialWeightsComplete = positions.length === 0 || positions.every((x) => x.initialWeightDataComplete);

      const cashReserves = cashReservesRaw.map((x) => ({
        ...x,
        weightPct: (x.amountBaseCcy != null && totalCapitalBaseCcy)
          ? (x.amountBaseCcy / totalCapitalBaseCcy) * 100
          : null
      }));

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
        // true doar daca TOATE pozitiile au un furnizor de preturi live
        // (price_source === 'live_feed'). Cat timp e false (cazul actual,
        // intotdeauna 'manual'), UI-ul trebuie sa afiseze "In asteptarea
        // datelor live" pentru valoare curenta / profit / randament - NU
        // cifrele de mai jos, care raman calculate din pretul de referinta.
        hasLivePriceData: allPricesLive,
        currentValueBaseCcy: totalWithKnownValue ? totalMarketValueBaseCcy : null,
        totalCashBaseCcy: totalCashWithKnownValue ? totalCashBaseCcy : null,
        totalCapitalBaseCcy,
        profitSinceFoundedBaseCcy: (totalWithKnownValue && p.initial_capital != null)
          ? totalMarketValueBaseCcy - p.initial_capital : null,
        totalReturnPct: latestPerf ? latestPerf.cumulativeReturnPct : null,
        // true doar daca TOATE pozitiile si TOATE rezervele cash au putut fi
        // convertite in moneda de baza (pretul curent). Uz intern/admin -
        // nu mai controleaza banner-ul din UI-ul membrilor (vezi
        // initialWeightsComplete mai jos, care controleaza banner-ul nou).
        dataComplete,
        // true doar daca TOATE pozitiile au putut sa isi calculeze
        // "pondere initiala" (adica au cel putin o tranzactie BUY si
        // cursul de conversie necesar exista in fx_rates). UI-ul membrilor
        // trebuie sa afiseze un banner "curs indisponibil" cand e false.
        initialWeightsComplete,
        positions,
        cashReserves,
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
