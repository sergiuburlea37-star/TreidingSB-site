/* member-portfolios.js
   Pagina dedicata portofoliilor membrilor (US/EU) - complet auto-continuta:
   nu depinde de script.js (evita orice cuplaj/risc pe o pagina noua), dar
   citeste/scrie aceeasi cheie de limba din localStorage ("tsb_lang") si
   acelasi token de sesiune ("tsb_session_token") ca restul site-ului, ca
   experienta sa fie consistenta.

   Sursa de date: EXCLUSIV /api/account-portfolios (Bearer <token>), acelasi
   endpoint protejat folosit si in Cabinet. Niciun date financiar nu e
   inventat aici - orice valoare care nu poate fi calculata cinstit
   (pret lipsa, curs valutar indisponibil) e afisata explicit ca atare
   ("—" / "curs indisponibil"), niciodata ca 0 sau o aproximare.
*/
(function () {
  "use strict";

  var LANG_KEY = "tsb_lang";
  var TOKEN_KEY = "tsb_session_token";
  var SUPPORTED_LANGS = ["ro", "en", "ru", "uk", "pl"];
  var LOCALE_MAP = { ro: "ro-RO", en: "en-GB", ru: "ru-RU", uk: "uk-UA", pl: "pl-PL" };
  var FLAGS = { ro: "ro", en: "gb", ru: "ru", uk: "ua", pl: "pl" };

  var STATE = {
    lang: "ro",
    token: null,
    portfolios: null,
    activeCode: "US",
    activeInterval: "1M",
    delayedDataMinutes: 15
  };

  /* ------------------------------------------------------------------ */
  /* i18n                                                                 */
  /* ------------------------------------------------------------------ */
  var I18N = {
    ro: {
      navHome: "Home", navCabinet: "Cabinet",
      loading: "Se încarcă portofoliile…",
      lockedTitle: "Conținut premium",
      lockedText: "Ai nevoie de un abonament activ pentru a vedea portofoliile complete.",
      lockedCta: "Vezi abonamentele",
      errorTitle: "Eroare",
      errorText: "Nu am putut încărca portofoliile. Încearcă din nou.",
      retry: "Reîncearcă",
      eyebrow: "Cabinet",
      title: "Portofoliile tale",
      delayedBadge: "Date live indisponibile momentan",
      lastUpdated: "Ultima actualizare:",
      tabUs: "Portofoliu US", tabEu: "Portofoliu EU",
      fxNote: "1 {ccy} = moneda de bază a portofoliului. Pozițiile în altă monedă sunt convertite folosind cel mai recent curs introdus de administrator (fx_rates).",
      incompleteNote: "⚠️ Ponderea inițială nu poate fi calculată momentan pentru unele poziții (lipsește tranzacția de achiziție sau cursul valutar necesar) — apare ca „curs indisponibil” în loc de o valoare aproximativă.",
      initialCapital: "Capital inițial", currentValue: "Valoare actuală",
      profitSince: "Profit de la fondare", totalReturn: "Randament",
      evolution: "Evoluție de la fondare",
      chartEmpty: "Istoricul performanței se construiește.",
      colTicker: "Ticker", colWeight: "Pondere inițială", colAvgPrice: "Preț mediu",
      colCurrentPrice: "Preț curent", colPl: "Profit/Pierdere", colRisk: "Risc",
      colCategory: "Categorie", colCashAmount: "Sumă", colCashStatus: "Status",
      colAmount: "Sumă", colPayDate: "Dată plată",
      colType: "Tip", colDate: "Dată",
      positionsHead: "Poziții active", cashHead: "Rezerve cash", dividendsHead: "Dividende",
      transactionsHead: "Tranzacții recente",
      swipeHint: "← Glisează pentru mai multe →",
      noData: "Nu există date disponibile.",
      cashEmpty: "Nicio rezervă cash înregistrată.",
      dividendsEmpty: "Niciun dividend înregistrat încă.",
      transactionsEmpty: "Nicio tranzacție înregistrată încă.",
      rateUnavailable: "curs indisponibil",
      referencePrice: "preț de referință",
      awaitingLiveData: "În așteptarea datelor live",
      disclaimer: "Date educaționale/demonstrative. Nu constituie consiliere de investiții.",
      statusReserved: "rezervat", statusReleased: "eliberat",
      cashCategories: {
        amplification_reserve: "Rezervă pentru amplificarea pozițiilor",
        cash_equivalent: "Numerar disponibil",
        iwfv_reserved: "Rezervat pentru IWFV",
        spcx_reserved: "Rezervat pentru SpaceX",
        novo_b_reserved: "Rezervat pentru NOVO B",
        buffer_defensiv: "Rezervă defensivă (buffer)"
      }
    },
    en: {
      navHome: "Home", navCabinet: "Dashboard",
      loading: "Loading your portfolios…",
      lockedTitle: "Premium content",
      lockedText: "You need an active subscription to view the full portfolios.",
      lockedCta: "See subscriptions",
      errorTitle: "Error",
      errorText: "We couldn't load the portfolios. Please try again.",
      retry: "Retry",
      eyebrow: "Dashboard",
      title: "Your portfolios",
      delayedBadge: "Live data currently unavailable",
      lastUpdated: "Last updated:",
      tabUs: "US Portfolio", tabEu: "EU Portfolio",
      fxNote: "1 {ccy} = the portfolio's base currency. Positions in other currencies are converted using the most recent rate entered by an admin (fx_rates).",
      incompleteNote: "⚠️ The initial weight can't currently be calculated for some positions (missing purchase transaction or a required FX rate) — shown as \"rate unavailable\" instead of an approximate value.",
      initialCapital: "Initial capital", currentValue: "Current value",
      profitSince: "Profit since founding", totalReturn: "Return",
      evolution: "Performance since founding",
      chartEmpty: "Performance history is being built.",
      colTicker: "Ticker", colWeight: "Initial weight", colAvgPrice: "Avg. price",
      colCurrentPrice: "Current price", colPl: "Profit/Loss", colRisk: "Risk",
      colCategory: "Category", colCashAmount: "Amount", colCashStatus: "Status",
      colAmount: "Amount", colPayDate: "Pay date",
      colType: "Type", colDate: "Date",
      positionsHead: "Active positions", cashHead: "Cash reserves", dividendsHead: "Dividends",
      transactionsHead: "Recent transactions",
      swipeHint: "← Swipe for more →",
      noData: "No data available.",
      cashEmpty: "No cash reserves recorded.",
      dividendsEmpty: "No dividends recorded yet.",
      transactionsEmpty: "No transactions recorded yet.",
      rateUnavailable: "rate unavailable",
      referencePrice: "reference price",
      awaitingLiveData: "Awaiting live data",
      disclaimer: "Educational/demo data. Not investment advice.",
      statusReserved: "reserved", statusReleased: "released",
      cashCategories: {
        amplification_reserve: "Reserve for position amplification",
        cash_equivalent: "Available cash",
        iwfv_reserved: "Reserved for IWFV",
        spcx_reserved: "Reserved for SpaceX",
        novo_b_reserved: "Reserved for NOVO B",
        buffer_defensiv: "Defensive buffer"
      }
    },
    ru: {
      navHome: "Главная", navCabinet: "Кабинет",
      loading: "Загрузка портфелей…",
      lockedTitle: "Премиум-контент",
      lockedText: "Для просмотра полных портфелей нужна активная подписка.",
      lockedCta: "Посмотреть подписки",
      errorTitle: "Ошибка",
      errorText: "Не удалось загрузить портфели. Попробуйте снова.",
      retry: "Повторить",
      eyebrow: "Кабинет",
      title: "Ваши портфели",
      delayedBadge: "Данные в реальном времени сейчас недоступны",
      lastUpdated: "Последнее обновление:",
      tabUs: "Портфель US", tabEu: "Портфель EU",
      fxNote: "1 {ccy} = базовая валюта портфеля. Позиции в других валютах конвертируются по последнему курсу, введённому администратором (fx_rates).",
      incompleteNote: "⚠️ Начальную долю сейчас нельзя рассчитать для некоторых позиций (отсутствует сделка покупки или нужный курс валюты) — показано как «курс недоступен» вместо приблизительного значения.",
      initialCapital: "Начальный капитал", currentValue: "Текущая стоимость",
      profitSince: "Прибыль с основания", totalReturn: "Доходность",
      evolution: "Динамика с момента основания",
      chartEmpty: "История доходности формируется.",
      colTicker: "Тикер", colWeight: "Начальная доля", colAvgPrice: "Средняя цена",
      colCurrentPrice: "Текущая цена", colPl: "Прибыль/Убыток", colRisk: "Риск",
      colCategory: "Категория", colCashAmount: "Сумма", colCashStatus: "Статус",
      colAmount: "Сумма", colPayDate: "Дата выплаты",
      colType: "Тип", colDate: "Дата",
      positionsHead: "Активные позиции", cashHead: "Резервы наличности", dividendsHead: "Дивиденды",
      transactionsHead: "Последние транзакции",
      swipeHint: "← Листайте для просмотра →",
      noData: "Нет доступных данных.",
      cashEmpty: "Резервы наличности не зафиксированы.",
      dividendsEmpty: "Дивиденды пока не зафиксированы.",
      transactionsEmpty: "Транзакции пока не зафиксированы.",
      rateUnavailable: "курс недоступен",
      referencePrice: "справочная цена",
      awaitingLiveData: "Ожидание живых данных",
      disclaimer: "Образовательные/демонстрационные данные. Не является инвестиционной консультацией.",
      statusReserved: "зарезервировано", statusReleased: "высвобождено",
      cashCategories: {
        amplification_reserve: "Резерв для увеличения позиций",
        cash_equivalent: "Доступные денежные средства",
        iwfv_reserved: "Зарезервировано для IWFV",
        spcx_reserved: "Зарезервировано для SpaceX",
        novo_b_reserved: "Зарезервировано для NOVO B",
        buffer_defensiv: "Защитный буфер"
      }
    },
    uk: {
      navHome: "Головна", navCabinet: "Кабінет",
      loading: "Завантаження портфелів…",
      lockedTitle: "Преміум-контент",
      lockedText: "Для перегляду повних портфелів потрібна активна підписка.",
      lockedCta: "Переглянути підписки",
      errorTitle: "Помилка",
      errorText: "Не вдалося завантажити портфелі. Спробуйте ще раз.",
      retry: "Повторити",
      eyebrow: "Кабінет",
      title: "Ваші портфелі",
      delayedBadge: "Дані в реальному часі наразі недоступні",
      lastUpdated: "Останнє оновлення:",
      tabUs: "Портфель US", tabEu: "Портфель EU",
      fxNote: "1 {ccy} = базова валюта портфеля. Позиції в інших валютах конвертуються за останнім курсом, введеним адміністратором (fx_rates).",
      incompleteNote: "⚠️ Початкову частку наразі не можна розрахувати для деяких позицій (відсутня угода купівлі або потрібний курс валюти) — показано як «курс недоступний» замість приблизного значення.",
      initialCapital: "Початковий капітал", currentValue: "Поточна вартість",
      profitSince: "Прибуток від заснування", totalReturn: "Дохідність",
      evolution: "Динаміка від заснування",
      chartEmpty: "Історія дохідності формується.",
      colTicker: "Тікер", colWeight: "Початкова частка", colAvgPrice: "Середня ціна",
      colCurrentPrice: "Поточна ціна", colPl: "Прибуток/Збиток", colRisk: "Ризик",
      colCategory: "Категорія", colCashAmount: "Сума", colCashStatus: "Статус",
      colAmount: "Сума", colPayDate: "Дата виплати",
      colType: "Тип", colDate: "Дата",
      positionsHead: "Активні позиції", cashHead: "Грошові резерви", dividendsHead: "Дивіденди",
      transactionsHead: "Останні транзакції",
      swipeHint: "← Прогорніть для деталей →",
      noData: "Немає доступних даних.",
      cashEmpty: "Грошові резерви не зафіксовано.",
      dividendsEmpty: "Дивіденди ще не зафіксовано.",
      transactionsEmpty: "Транзакції ще не зафіксовано.",
      rateUnavailable: "курс недоступний",
      referencePrice: "довідкова ціна",
      awaitingLiveData: "Очікування живих даних",
      disclaimer: "Освітні/демонстраційні дані. Не є інвестиційною консультацією.",
      statusReserved: "зарезервовано", statusReleased: "звільнено",
      cashCategories: {
        amplification_reserve: "Резерв для збільшення позицій",
        cash_equivalent: "Доступні грошові кошти",
        iwfv_reserved: "Зарезервовано для IWFV",
        spcx_reserved: "Зарезервовано для SpaceX",
        novo_b_reserved: "Зарезервовано для NOVO B",
        buffer_defensiv: "Захисний буфер"
      }
    },
    pl: {
      navHome: "Strona główna", navCabinet: "Panel",
      loading: "Wczytywanie portfeli…",
      lockedTitle: "Treść premium",
      lockedText: "Potrzebujesz aktywnej subskrypcji, aby zobaczyć pełne portfele.",
      lockedCta: "Zobacz subskrypcje",
      errorTitle: "Błąd",
      errorText: "Nie udało się wczytać portfeli. Spróbuj ponownie.",
      retry: "Ponów",
      eyebrow: "Panel",
      title: "Twoje portfele",
      delayedBadge: "Dane na żywo są obecnie niedostępne",
      lastUpdated: "Ostatnia aktualizacja:",
      tabUs: "Portfel US", tabEu: "Portfel EU",
      fxNote: "1 {ccy} = waluta bazowa portfela. Pozycje w innych walutach są przeliczane po najnowszym kursie wprowadzonym przez administratora (fx_rates).",
      incompleteNote: "⚠️ Wagi początkowej nie można obecnie obliczyć dla niektórych pozycji (brak transakcji zakupu lub potrzebnego kursu walutowego) — pokazane jako „kurs niedostępny” zamiast wartości przybliżonej.",
      initialCapital: "Kapitał początkowy", currentValue: "Wartość bieżąca",
      profitSince: "Zysk od założenia", totalReturn: "Stopa zwrotu",
      evolution: "Wyniki od założenia",
      chartEmpty: "Historia wyników jest budowana.",
      colTicker: "Ticker", colWeight: "Waga początkowa", colAvgPrice: "Śr. cena",
      colCurrentPrice: "Cena bieżąca", colPl: "Zysk/Strata", colRisk: "Ryzyko",
      colCategory: "Kategoria", colCashAmount: "Kwota", colCashStatus: "Status",
      colAmount: "Kwota", colPayDate: "Data wypłaty",
      colType: "Typ", colDate: "Data",
      positionsHead: "Aktywne pozycje", cashHead: "Rezerwy gotówkowe", dividendsHead: "Dywidendy",
      transactionsHead: "Ostatnie transakcje",
      swipeHint: "← Przesuń, aby zobaczyć więcej →",
      noData: "Brak dostępnych danych.",
      cashEmpty: "Brak zarejestrowanych rezerw gotówkowych.",
      dividendsEmpty: "Brak zarejestrowanych dywidend.",
      transactionsEmpty: "Brak zarejestrowanych transakcji.",
      rateUnavailable: "kurs niedostępny",
      referencePrice: "cena referencyjna",
      awaitingLiveData: "Oczekiwanie na dane na żywo",
      disclaimer: "Dane edukacyjne/demonstracyjne. Nie stanowią porady inwestycyjnej.",
      statusReserved: "zarezerwowane", statusReleased: "zwolnione",
      cashCategories: {
        amplification_reserve: "Rezerwa na zwiększenie pozycji",
        cash_equivalent: "Dostępna gotówka",
        iwfv_reserved: "Zarezerwowane dla IWFV",
        spcx_reserved: "Zarezerwowane dla SpaceX",
        novo_b_reserved: "Zarezerwowane dla NOVO B",
        buffer_defensiv: "Bufor defensywny"
      }
    }
  };

  function t(key) {
    var dict = I18N[STATE.lang] || I18N.ro;
    return dict[key] || (I18N.ro[key] || key);
  }

  // Traducerea categoriilor de rezerve cash (portfolio_cash_reserves.category
  // - slug-uri brute din seed, ex. "amplification_reserve"). Fallback pe
  // categoria bruta (nu pe RO) daca apare vreodata o categorie noua,
  // necunoscuta - niciodata un text gol sau inventat.
  function cashCategoryLabel(category) {
    var dict = (I18N[STATE.lang] && I18N[STATE.lang].cashCategories) || {};
    var fallback = (I18N.ro && I18N.ro.cashCategories) || {};
    return dict[category] || fallback[category] || category;
  }

  function getLang() {
    try {
      var stored = localStorage.getItem(LANG_KEY);
      if (stored && SUPPORTED_LANGS.indexOf(stored) > -1) return stored;
    } catch (e) { /* ignore */ }
    return "ro";
  }

  function setLang(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
    STATE.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    applyStaticTexts();
    if (STATE.portfolios) renderActiveTab();
    updateLangSwitcherUI();
  }

  function updateLangSwitcherUI() {
    var flagEl = document.getElementById("mpLangCurrentFlag");
    var codeEl = document.getElementById("mpLangCurrentCode");
    if (flagEl) flagEl.src = "https://flagcdn.com/" + (FLAGS[STATE.lang] || "ro") + ".svg";
    if (codeEl) codeEl.textContent = STATE.lang.toUpperCase();
  }

  function applyStaticTexts() {
    var set = function (id, text) { var el = document.getElementById(id); if (el) el.textContent = text; };
    set("mpNavHome", t("navHome"));
    set("mpNavCabinet", t("navCabinet"));
    set("mpNavCabinetMenu", t("navCabinet"));
    set("mpLoadingText", t("loading"));
    set("mpLockedTitle", t("lockedTitle"));
    set("mpLockedText", t("lockedText"));
    set("mpLockedCta", t("lockedCta"));
    set("mpErrorTitle", t("errorTitle"));
    set("mpErrorText", t("errorText"));
    set("mpRetryBtn", t("retry"));
    set("mpEyebrow", t("eyebrow"));
    set("mpTitle", t("title"));
    set("mpTabUsLabel", t("tabUs"));
    set("mpTabEuLabel", t("tabEu"));
    set("mpEvolutionLabel", t("evolution"));
    set("mpChartEmptyText", t("chartEmpty"));
    set("mpColTicker", t("colTicker"));
    set("mpColWeight", t("colWeight"));
    set("mpColAvgPrice", t("colAvgPrice"));
    set("mpColCurrentPrice", t("colCurrentPrice"));
    set("mpColPl", t("colPl"));
    set("mpColRisk", t("colRisk"));
    set("mpColCategory", t("colCategory"));
    set("mpColCashAmount", t("colCashAmount"));
    set("mpColCashStatus", t("colCashStatus"));
    set("mpColTicker2", t("colTicker"));
    set("mpColAmount", t("colAmount"));
    set("mpColPayDate", t("colPayDate"));
    set("mpColType", t("colType"));
    set("mpColTicker3", t("colTicker"));
    set("mpColAmount2", t("colAmount"));
    set("mpColDate", t("colDate"));
    set("mpPositionsHead", t("positionsHead"));
    set("mpCashHead", t("cashHead"));
    set("mpDividendsHead", t("dividendsHead"));
    set("mpTransactionsHead", t("transactionsHead"));
    set("mpSwipeHint", t("swipeHint"));
    set("mpCashEmpty", t("cashEmpty"));
    set("mpDividendsEmpty", t("dividendsEmpty"));
    set("mpTransactionsEmpty", t("transactionsEmpty"));
    set("mpDisclaimer", t("disclaimer"));
    // (2026-07-30) Badge-ul NU mai promite un interval de intarziere ("~15
    // minute") - nicio integrare de preturi live nu e activa inca (vezi
    // price_source = 'manual' pe toate pozitiile), deci acea promisiune nu
    // putea fi sustinuta de infrastructura curenta. Textul e acum onest:
    // "date live indisponibile momentan", fara sa depinda de
    // STATE.delayedDataMinutes. Cand un furnizor de preturi live va fi
    // integrat si activ, acest badge (si traducerile din I18N) trebuie
    // revizuite din nou, cu cadenta reala confirmata (vezi raportul separat
    // despre limitele planului Vercel curent - cron o data/zi pe Hobby).
    var delayedBadge = document.getElementById("mpDelayedBadge");
    if (delayedBadge) delayedBadge.textContent = t("delayedBadge");
    document.documentElement.lang = STATE.lang;
  }

  /* ------------------------------------------------------------------ */
  /* Header interactivity (self-contained, mirrors index.html)          */
  /* ------------------------------------------------------------------ */
  function wireHeader() {
    var langSwitcher = document.getElementById("mpLangSwitcher");
    var langBtn = document.getElementById("mpLangCurrentBtn");
    var langMenu = document.getElementById("mpLangMenu");
    if (langBtn && langMenu && langSwitcher) {
      langBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = langSwitcher.classList.toggle("is-open");
        langBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      langMenu.querySelectorAll("[data-lang]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setLang(btn.getAttribute("data-lang"));
          langSwitcher.classList.remove("is-open");
          langBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    var mobileToggle = document.getElementById("mpMobileToggle");
    var mainNav = document.getElementById("mpMainNav");
    if (mobileToggle && mainNav) {
      mobileToggle.addEventListener("click", function () {
        var open = mainNav.classList.toggle("is-open");
        mobileToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    var accountDropdown = document.getElementById("mpAccountDropdown");
    var memberBtn = document.getElementById("mpMemberButton");
    if (accountDropdown && memberBtn) {
      memberBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = accountDropdown.classList.toggle("is-open");
        memberBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    document.addEventListener("click", function () {
      if (langSwitcher) { langSwitcher.classList.remove("is-open"); if (langBtn) langBtn.setAttribute("aria-expanded", "false"); }
      if (accountDropdown) { accountDropdown.classList.remove("is-open"); if (memberBtn) memberBtn.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Formatting helpers                                                  */
  /* ------------------------------------------------------------------ */
  var CCY_SYMBOLS = { GBP: "£", EUR: "€", USD: "$", CHF: "CHF ", SEK: "SEK ", DKK: "DKK " };

  function fmtMoney(amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
    var sign = amount < 0 ? "-" : "";
    return sign + symbol + Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return "—";
    return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
  }

  function fmtWeight(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return null;
    return pct.toFixed(1) + "%";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
      return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return iso; }
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
      return new Date(iso).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------ */
  /* State switching                                                     */
  /* ------------------------------------------------------------------ */
  function showState(name) {
    ["mpStateLoading", "mpStateLocked", "mpStateError", "mpStateDashboard"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== name);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Auth + data loading                                                 */
  /* ------------------------------------------------------------------ */
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function redirectToLogin() {
    window.location.href = "index.html#account";
  }

  function loadEmailHeader(token) {
    fetch("/api/auth-me", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        var emailEl = document.getElementById("mpMemberEmail");
        if (emailEl && res.ok && res.data && res.data.success && res.data.email) {
          emailEl.textContent = res.data.email;
        }
      })
      .catch(function () {});
  }

  function loadPortfolios() {
    var token = getToken();
    STATE.token = token;
    if (!token) {
      redirectToLogin();
      return;
    }

    showState("mpStateLoading");
    loadEmailHeader(token);

    fetch("/api/account-portfolios", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
      .then(function (res) {
        if (res.status === 401) {
          try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
          redirectToLogin();
          return;
        }
        if (res.status === 403) {
          showState("mpStateLocked");
          return;
        }
        if (res.ok && res.data && res.data.success && Array.isArray(res.data.portfolios)) {
          STATE.portfolios = res.data.portfolios;
          STATE.delayedDataMinutes = res.data.delayedDataMinutes || 15;
          applyStaticTexts();
          wireDashboardControlsOnce();
          renderActiveTab();
          showState("mpStateDashboard");
          return;
        }
        showState("mpStateError");
      })
      .catch(function () {
        showState("mpStateError");
      });
  }

  var CONTROLS_WIRED = false;
  function wireDashboardControlsOnce() {
    if (CONTROLS_WIRED) return;
    CONTROLS_WIRED = true;

    var tabs = document.getElementById("mpTabs");
    if (tabs) {
      tabs.querySelectorAll("[data-mp-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var code = btn.getAttribute("data-mp-tab");
          if (code === STATE.activeCode) return;
          STATE.activeCode = code;
          tabs.querySelectorAll("[data-mp-tab]").forEach(function (b) {
            var active = b === btn;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-selected", active ? "true" : "false");
          });
          renderActiveTab();
        });
      });
    }

    var intervalSwitch = document.getElementById("mpIntervalSwitch");
    if (intervalSwitch) {
      intervalSwitch.querySelectorAll("button[data-interval]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          STATE.activeInterval = btn.getAttribute("data-interval");
          intervalSwitch.querySelectorAll("button[data-interval]").forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          renderActiveTab();
        });
      });
    }

    var retryBtn = document.getElementById("mpRetryBtn");
    if (retryBtn) retryBtn.addEventListener("click", loadPortfolios);

    // Deep-link din teaserele publice: member-portfolios.html?portfolio=EU
    try {
      var qp = new URLSearchParams(window.location.search).get("portfolio");
      if (qp === "US" || qp === "EU") {
        STATE.activeCode = qp;
        var tabsEl = document.getElementById("mpTabs");
        if (tabsEl) {
          tabsEl.querySelectorAll("[data-mp-tab]").forEach(function (b) {
            var active = b.getAttribute("data-mp-tab") === qp;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-selected", active ? "true" : "false");
          });
        }
      }
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */
  function renderActiveTab() {
    if (!STATE.portfolios) return;
    var p = STATE.portfolios.filter(function (x) { return x.code === STATE.activeCode; })[0];

    var updatedEl = document.getElementById("mpUpdatedAt");
    if (updatedEl) {
      updatedEl.textContent = p && p.lastUpdatedAt
        ? t("lastUpdated") + " " + fmtDateTime(p.lastUpdatedAt)
        : t("lastUpdated") + " —";
    }

    var fxNote = document.getElementById("mpFxNote");
    if (fxNote) fxNote.textContent = p ? t("fxNote").replace("{ccy}", p.baseCurrency) : "";

    var incompleteNote = document.getElementById("mpIncompleteNote");
    if (incompleteNote) {
      // Banner-ul e legat de "Pondere initiala" (initialWeightsComplete),
      // nu de vechiul dataComplete (bazat pe pretul curent) - vezi
      // api/account-portfolios.js.
      var incomplete = !!(p && p.initialWeightsComplete === false);
      incompleteNote.hidden = !incomplete;
      if (incomplete) incompleteNote.textContent = t("incompleteNote");
    }

    renderStatCards(p);
    renderChart(p ? p.performanceHistory : []);
    renderPositions(p ? p.positions : [], p ? p.baseCurrency : null);
    renderCashReserves(p ? p.cashReserves : [], p ? p.baseCurrency : null);
    renderDividends(p ? p.dividends : []);
    renderTransactions(p ? p.transactions : []);
  }

  function statCardHtml(value, label, pending) {
    var cls = "stat-mini-val" + (pending ? " mp-stat-pending" : "");
    return "<div class=\"stat-mini\"><div class=\"" + cls + "\">" + esc(value) +
      "</div><div class=\"stat-mini-lbl\">" + esc(label) + "</div></div>";
  }

  function renderStatCards(p) {
    var el = document.getElementById("mpStatsCards");
    if (!el) return;
    if (!p) {
      el.innerHTML = "<p class=\"portfolio-empty-note\">" + esc(t("noData")) + "</p>";
      return;
    }
    // Valoare actuala / profit / randament sunt derivate din pretul curent -
    // cat timp portofoliul nu are inca un furnizor de preturi live
    // (p.hasLivePriceData === false, cazul actual pentru toate pozitiile),
    // NU trebuie afisate ca cifre (nici macar bazate pe pretul de referinta),
    // ci explicit "In asteptarea datelor live".
    var live = !!p.hasLivePriceData;
    el.innerHTML = [
      statCardHtml(fmtMoney(p.initialCapital, p.baseCurrency), t("initialCapital"), false),
      statCardHtml(live && p.currentValueBaseCcy != null ? fmtMoney(p.currentValueBaseCcy, p.baseCurrency) : t("awaitingLiveData"), t("currentValue"), !live),
      statCardHtml(live && p.profitSinceFoundedBaseCcy != null ? fmtMoney(p.profitSinceFoundedBaseCcy, p.baseCurrency) : t("awaitingLiveData"), t("profitSince"), !live),
      statCardHtml(live && p.totalReturnPct != null ? fmtPct(p.totalReturnPct) : t("awaitingLiveData"), t("totalReturn"), !live)
    ].join("");
  }

  function filterHistoryByInterval(history, interval) {
    if (!history || !history.length) return [];
    if (interval === "MAX") return history;
    var lastDate = new Date(history[history.length - 1].asOfDate);
    var cutoff = new Date(lastDate);
    if (interval === "1M") cutoff.setMonth(cutoff.getMonth() - 1);
    else if (interval === "3M") cutoff.setMonth(cutoff.getMonth() - 3);
    else if (interval === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);
    return history.filter(function (h) { return new Date(h.asOfDate) >= cutoff; });
  }

  // Grafic minimal, in SVG inline vanilla JS - fara librarie externa, ca sa
  // nu fie nevoie sa extindem CSP script-src (vezi vercel.json). Cand nu sunt
  // suficiente puncte (nevoie de minim 2 instantanee reale din
  // portfolio_performance_history), afisam un card compact in loc de grafic.
  //
  // Nota (2026-07-30, hotfix): #mpChartWrap avea min-height:320px in CSS
  // (vezi member-portfolios.css) indiferent daca era gol sau nu - cand
  // filtered.length < 2, doar innerHTML era golit, dar elementul tot ocupa
  // 320px goi pe ecran, DEASUPRA cardului compact #mpChartEmpty - asta
  // producea aspectul de "grafic care nu se afiseaza corect" (un bloc gol
  // mare, nu un card compact). Fix: ascunde explicit #mpChartWrap (atributul
  // hidden => display:none, nicio regula CSS nu il suprascrie) cat timp nu
  // are ce desena, si reafiseaza-l quand exista suficiente puncte.
  function renderChart(history) {
    var wrap = document.getElementById("mpChartWrap");
    var emptyEl = document.getElementById("mpChartEmpty");
    if (!wrap) return;

    var filtered = filterHistoryByInterval(history, STATE.activeInterval);
    if (!filtered || filtered.length < 2) {
      wrap.innerHTML = "";
      wrap.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    wrap.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    var W = 1000, H = 280, PAD = 10;
    var values = filtered.map(function (h) { return h.navValue; });
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (min === max) { min -= 1; max += 1; }
    var stepX = (W - PAD * 2) / (filtered.length - 1);

    var points = filtered.map(function (h, i) {
      var x = PAD + i * stepX;
      var y = H - PAD - ((h.navValue - min) / (max - min)) * (H - PAD * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    });

    var trendUp = values[values.length - 1] >= values[0];
    var strokeColor = trendUp ? "#18d98b" : "#ff4056";
    var areaPoints = points.concat([(PAD + (filtered.length - 1) * stepX).toFixed(1) + "," + (H - PAD), PAD + "," + (H - PAD)]);

    var svg = "<svg viewBox=\"0 0 " + W + " " + H + "\" preserveAspectRatio=\"none\" role=\"img\" aria-label=\"" +
      esc(t("evolution")) + "\">" +
      "<polygon points=\"" + areaPoints.join(" ") + "\" fill=\"" + strokeColor + "\" fill-opacity=\"0.12\" stroke=\"none\"></polygon>" +
      "<polyline points=\"" + points.join(" ") + "\" fill=\"none\" stroke=\"" + strokeColor + "\" stroke-width=\"2.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></polyline>" +
      "</svg>";
    wrap.innerHTML = svg;
  }

  function renderPositions(positions, baseCurrency) {
    var body = document.getElementById("mpPositionsBody");
    if (!body) return;
    if (!positions || !positions.length) {
      body.innerHTML = "<tr><td colspan=\"6\">" + esc(t("noData")) + "</td></tr>";
      return;
    }
    body.innerHTML = positions.map(function (pos) {
      // Pondere initiala (initialWeightPct): suma tranzactiilor BUY ale
      // pozitiei / capitalul initial al portofoliului - fixa, istorica,
      // NU depinde de pretul curent. null (nu 0) cand lipseste tranzactia
      // BUY sau cursul de conversie necesar - "curs indisponibil" explicit.
      var weightText = fmtWeight(pos.initialWeightPct);
      var weightHtml = weightText ? esc(weightText) : "<span class=\"mp-weight-na\">" + esc(t("rateUnavailable")) + "</span>";

      // Pret curent / profit: pana la integrarea unui furnizor de preturi
      // live (priceSource === 'live_feed'), NU se afiseaza nicio cifra -
      // nici macar pretul de referinta - ci explicit "In asteptarea
      // datelor live". Vezi cerinta: nu prezenta pretul de referinta ca
      // pret live.
      var isLive = pos.priceSource === "live_feed";
      var currentPriceHtml = isLive && pos.currentPrice != null
        ? esc(fmtMoney(pos.currentPrice, pos.instrumentCurrency))
        : "<span class=\"mp-awaiting-live\">" + esc(t("awaitingLiveData")) + "</span>";

      var plClass = pos.plInstrumentCcy > 0 ? "mp-pl-pos" : (pos.plInstrumentCcy < 0 ? "mp-pl-neg" : "mp-pl-flat");
      var plHtml = isLive && pos.plInstrumentCcy != null
        ? esc(fmtMoney(pos.plInstrumentCcy, pos.instrumentCurrency) + " (" + fmtPct(pos.plPct) + ")")
        : "<span class=\"mp-awaiting-live\">" + esc(t("awaitingLiveData")) + "</span>";
      if (!isLive) plClass = "mp-cell-muted";

      var riskClass = pos.riskLevel === "high" ? "high" : (pos.riskLevel === "low" ? "low" : "med");

      return "<tr><td class=\"ticker\">" + esc(pos.ticker) + "</td>" +
        "<td>" + weightHtml + "</td>" +
        "<td>" + esc(fmtMoney(pos.avgPrice, pos.instrumentCurrency)) + "</td>" +
        "<td>" + currentPriceHtml + "</td>" +
        "<td class=\"" + plClass + "\">" + plHtml + "</td>" +
        "<td><span class=\"risk-badge " + riskClass + "\">" + esc(pos.riskLevel || "—") + "</span></td></tr>";
    }).join("");
  }

  function renderCashReserves(reserves, baseCurrency) {
    var body = document.getElementById("mpCashBody");
    var empty = document.getElementById("mpCashEmpty");
    if (!body) return;
    if (!reserves || !reserves.length) {
      body.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = reserves.map(function (r) {
      var statusLabel = r.status === "released" ? t("statusReleased") : t("statusReserved");
      var label = cashCategoryLabel(r.category) + (r.reservedForTicker ? " (" + r.reservedForTicker + ")" : "");
      return "<tr><td>" + esc(label) + "</td>" +
        "<td>" + esc(fmtMoney(r.amount, r.currency)) + "</td>" +
        "<td>" + esc(statusLabel) + "</td></tr>";
    }).join("");
  }

  function renderDividends(dividends) {
    var body = document.getElementById("mpDividendsBody");
    var empty = document.getElementById("mpDividendsEmpty");
    if (!body) return;
    if (!dividends || !dividends.length) {
      body.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = dividends.map(function (d) {
      return "<tr><td class=\"ticker\">" + esc(d.ticker) + "</td>" +
        "<td>" + esc(fmtMoney(d.amount, d.currency)) + "</td>" +
        "<td>" + esc(fmtDate(d.payDate)) + "</td></tr>";
    }).join("");
  }

  function renderTransactions(transactions) {
    var body = document.getElementById("mpTransactionsBody");
    var empty = document.getElementById("mpTransactionsEmpty");
    if (!body) return;
    if (!transactions || !transactions.length) {
      body.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = transactions.map(function (tx) {
      return "<tr><td>" + esc(tx.type) + "</td>" +
        "<td class=\"ticker\">" + esc(tx.ticker || "—") + "</td>" +
        "<td>" + esc(fmtMoney(tx.amount, tx.currency)) + "</td>" +
        "<td>" + esc(fmtDate(tx.executedAt)) + "</td></tr>";
    }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  function init() {
    STATE.lang = getLang();
    wireHeader();
    updateLangSwitcherUI();
    applyStaticTexts();
    loadPortfolios();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
