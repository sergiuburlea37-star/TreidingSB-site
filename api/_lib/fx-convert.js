// api/_lib/fx-convert.js
//
// Conversii valutare bazate pe public.fx_rates
// (base_currency, quote_currency, rate, as_of_date - "1 base_currency = rate
// * quote_currency"). Extras din api/account-portfolios.js (2026-07-30) intr-un
// modul separat, format din functii PURE (fara Supabase/HTTP), special ca sa
// poata fi testat izolat - vezi tests/portfolio-weights.test.mjs.
//
// Doua moduri de conversie, cu semantici diferite - NU sunt interschimbabile:
//
//   convert(amount, from, to)
//     Cel mai recent curs cunoscut ACUM (indiferent de data lui). Potrivit
//     STRICT pentru valoare/cash CURENT (marketValueBaseCcy, rezerve cash) -
//     acolo nu exista o data de tranzactie de respectat, doar "care e cea
//     mai buna informatie pe care o avem acum".
//
//   convertAsOf(amount, from, to, targetDate)
//     Cursul valabil la (sau inainte de) targetDate - foloseste cursul EXACT
//     de la targetDate daca exista, altfel cel mai recent curs ANTERIOR,
//     NICIODATA un curs cu o data ULTERIOARA lui targetDate. Singurul mod
//     corect de a converti o tranzactie ISTORICA (ex. suma tranzactiilor BUY
//     pentru "Pondere initiala") - a folosi un curs ulterior tranzactiei ar
//     insemna sa pretindem ca acel curs era cunoscut la momentul tranzactiei,
//     ceea ce e fals si ar produce o pondere care nu a existat niciodata cu
//     adevarat la acea data.
//
// Ambele: triangulare printr-o moneda-punte (EUR) ca fallback, STRICT in
// aceeasi as_of_date (nu se combina niciodata doua date diferite intr-un
// curs derivat artificial). Returneaza null (niciodata 0 sau o valoare
// inventata) cand nu exista niciun curs aplicabil - apelantul trebuie sa
// afiseze explicit "curs indisponibil", nu o aproximare.

export function createFxConverter(fxRows) {
  const validRows = (fxRows || []).filter((r) => {
    const rate = Number(r && r.rate);
    return r && r.base_currency && r.quote_currency && r.as_of_date && Number.isFinite(rate) && rate > 0;
  }).map((r) => ({ ...r, rate: Number(r.rate) }));

  // Cel mai recent curs disponibil per pereche valutara, indiferent de data.
  const latestFx = {};
  validRows.forEach((r) => {
    const key = r.base_currency + '_' + r.quote_currency;
    if (!latestFx[key]) latestFx[key] = r; // primul intalnit e cel mai recent, DACA fxRows e sortat desc dupa as_of_date
  });

  // Cursuri indexate si pe as_of_date (separat de latestFx) - necesar STRICT
  // pentru triangulare (bridging) si pentru convertAsOf, ca sa nu se combine
  // niciodata un curs EUR/X de la o data cu un curs EUR/Y de la alta data
  // intr-un curs derivat artificial.
  const fxByDate = {}; // as_of_date -> { 'BASE_QUOTE': rate }
  validRows.forEach((r) => {
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

  // Triangulare printr-o moneda-punte (implicit EUR): amount (in "from") ->
  // punte -> "to", folosind DOAR cele doua cursuri punte->from si punte->to
  // citite din ACEEASI as_of_date. Incearca datele disponibile de la cea mai
  // recenta la cea mai veche, foloseste prima data la care ambele cursuri
  // exista. Nu aproximeaza si nu introduce niciun curs nou.
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
    const viaEur = convertViaBridge(amount, from, to, 'EUR');
    if (viaEur != null) return viaEur;
    return null; // fara curs disponibil (nici direct, nici invers, nici prin triangulare)
  }

  // targetDate trebuie sa fie un string 'YYYY-MM-DD' (comparabil lexical cu
  // as_of_date, stocat in acelasi format). Daca targetDate lipseste sau nu
  // exista niciun curs cu as_of_date <= targetDate, returneaza null - nu
  // "imprumuta" niciodata un curs ulterior doar ca sa completeze o valoare.
  function convertAsOf(amount, from, to, targetDate) {
    if (from === to) return amount;
    if (!targetDate) return null;

    const eligibleDates = fxDatesDesc.filter((d) => d <= targetDate);

    for (const d of eligibleDates) {
      const ratesForDate = fxByDate[d];
      const direct = rateOnDate(from, to, ratesForDate);
      if (direct != null) return amount * direct;
      if (from !== 'EUR' && to !== 'EUR') {
        const bridgeToFrom = rateOnDate('EUR', from, ratesForDate);
        const bridgeToTo = rateOnDate('EUR', to, ratesForDate);
        if (bridgeToFrom != null && bridgeToTo != null) {
          return (amount / bridgeToFrom) * bridgeToTo;
        }
      }
    }
    return null; // niciun curs valabil la sau inainte de targetDate
  }

  return { convert, convertAsOf, latestFx, fxByDate, fxDatesDesc };
}
