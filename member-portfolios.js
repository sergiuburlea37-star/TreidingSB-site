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

  // Datele de fondare folosite STRICT pentru bucketing-ul axei X ("Luna N de
  // la fondare" - vezi monthsSinceFounding mai jos). Primite explicit de la
  // admin pentru aceasta cerinta (2026-08-05).
  //
  // NOTA DE TRANSPARENTA (neschimbata fara aprobare separata): valoarea
  // confirmata anterior, prin interogare read-only Supabase, pentru
  // portfolios.founded_date al portofoliului EU a fost 2026-05-17 - cu o zi
  // mai devreme decat 2026-05-18 primit acum pentru acest calcul. Am folosit
  // EXACT data ceruta aici (2026-05-18), fara sa o corectez pe cont propriu,
  // dar semnalez discrepanta in raportul final ca sa fie reconciliata de
  // admin (posibil doar o diferenta de fus orar/zi in seed vs. formularea
  // ceruta aici) - vezi si nota din drawChart.
  var FOUNDING_DATES = { US: "2026-05-07", EU: "2026-05-18" };

  var STATE = {
    lang: "ro",
    token: null,
    portfolios: null,
    activeCode: "US",
    activeInterval: "1M",
    delayedDataMinutes: 15,
    // Etapa 4: garda impotriva cererilor suprapuse (poll la 60s + un retry
    // manual/revenire pe tab intamplate simultan) - vezi loadPortfolios.
    loading: false,
    // Punctele (filtrate dupa interval) ale graficului curent afisat -
    // pastrate aici doar ca sa poata fi redesenate la resize (vezi
    // renderChart/drawChart mai jos), fara sa mai treaca din nou prin
    // filterHistoryByInterval.
    chartPoints: null,
    // Metadatele graficului curent (moneda, capitalul initial, data de
    // fondare) - salvate odata cu chartPoints ca sa poata fi refolosite la
    // redesenarea din resize (vezi wireDashboardControlsOnce), fara sa
    // recalculam din STATE.portfolios.
    chartMeta: null,
  };

  /* ------------------------------------------------------------------ */
  /* i18n */
  /* ------------------------------------------------------------------ */
  var I18N = {
    ro: {
      navHome: "Home",
      navCabinet: "Cabinet",
      loading: "Se încarcă portofoliile…",
      lockedTitle: "Conținut premium",
      lockedText: "Ai nevoie de un abonament activ pentru a vedea portofoliile complete.",
      lockedCta: "Vezi abonamentele",
      errorTitle: "Eroare",
      errorText: "Nu am putut încărca portofoliile. Încearcă din nou.",
      retry: "Reîncearcă",
      eyebrow: "Cabinet",
      title: "Portofoliile tale",
      // Etapa 4 (EODHD Live Delayed): sablon cu {min}, interpolat in
      // applyStaticTexts() cu STATE.delayedDataMinutes - vezi acolo.
      delayedBadge: "Date întârziate ~{min}-20 min",
      syncPartialNote:
        "⚠️ Ultima sincronizare de prețuri a fost parțială — datele afișate sunt din ultima sincronizare completă reușită.",
      returnPending: "Randament în calcul (TWR)",
      holdingsValueLabel: "Valoare poziții (fără numerar): {amount}",
      lastUpdated: "Ultima actualizare:",
      tabUs: "Portofoliu US",
      tabEu: "Portofoliu EU",
      fxNote:
        "1 {ccy} = moneda de bază a portofoliului. Pozițiile în altă monedă sunt convertite folosind cel mai recent curs introdus de administrator (fx_rates).",
      incompleteNote:
        "⚠️ Ponderea inițială nu poate fi calculată momentan pentru unele poziții (lipsește tranzacția de achiziție sau cursul valutar necesar) — apare ca „curs indisponibil” în loc de o valoare aproximativă.",
      initialCapital: "Capital inițial",
      currentValue: "Valoare actuală",
      profitSince: "Profit de la fondare",
      totalReturn: "Randament",
      evolution: "Evoluție de la fondare",
      chartEmpty: "Istoricul performanței se construiește.",
      chartValueLabel: "Valoare portofoliu",
      chartTotalValue: "Valoare totală",
      chartCapitalInvested: "Capital investit",
      chartProfit: "Profit",
      chartMonthShort: "Luna {n}",
      chartMonthSinceFounding: "Luna {n} de la fondare",
      chartInitialCapitalLine: "Capital inițial: {amount}",
      chartTitleTemplate: "Evoluție portofoliu {code}",
      chartSubtitleTemplate: "Valoare totală (NAV) în {ccy}",
      chartMonthDashTemplate: "Luna {n} — {month}",
      lastSnapshotAvailable: "Ultimul instantaneu disponibil",
      returnSinceFounding: "Randament de la fondare",
      colTicker: "Ticker",
      colWeight: "Pondere inițială",
      colAvgPrice: "Preț mediu",
      colCurrentPrice: "Preț curent",
      colPl: "Profit/Pierdere",
      colRisk: "Risc",
      colCategory: "Categorie",
      colCashAmount: "Sumă",
      colCashStatus: "Status",
      colAmount: "Sumă",
      colPayDate: "Dată plată",
      colType: "Tip",
      colDate: "Dată",
      positionsHead: "Poziții active",
      cashHead: "Rezerve cash",
      dividendsHead: "Dividende",
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
      statusReserved: "rezervat",
      statusReleased: "eliberat",
      cashCategories: {
        amplification_reserve: "Rezervă pentru amplificarea pozițiilor",
        cash_equivalent: "Numerar disponibil",
        iwfv_reserved: "Rezervat pentru IWFV",
        spcx_reserved: "Rezervat pentru SpaceX",
        novo_b_reserved: "Rezervat pentru NOVO B",
        buffer_defensiv: "Rezervă defensivă (buffer)",
      },
    },
    en: {
      navHome: "Home",
      navCabinet: "Dashboard",
      loading: "Loading your portfolios…",
      lockedTitle: "Premium content",
      lockedText: "You need an active subscription to view the full portfolios.",
      lockedCta: "See subscriptions",
      errorTitle: "Error",
      errorText: "We couldn't load the portfolios. Please try again.",
      retry: "Retry",
      eyebrow: "Dashboard",
      title: "Your portfolios",
      delayedBadge: "Delayed data ~{min}-20 min",
      syncPartialNote:
        "⚠️ The latest price sync was partial — the data shown is from the last fully successful sync.",
      returnPending: "Return pending (TWR)",
      holdingsValueLabel: "Positions value (excluding cash): {amount}",
      lastUpdated: "Last updated:",
      tabUs: "US Portfolio",
      tabEu: "EU Portfolio",
      fxNote:
        "1 {ccy} = the portfolio's base currency. Positions in other currencies are converted using the most recent rate entered by an admin (fx_rates).",
      incompleteNote:
        '⚠️ The initial weight can\'t currently be calculated for some positions (missing purchase transaction or a required FX rate) — shown as "rate unavailable" instead of an approximate value.',
      initialCapital: "Initial capital",
      currentValue: "Current value",
      profitSince: "Profit since founding",
      totalReturn: "Return",
      evolution: "Performance since founding",
      chartEmpty: "Performance history is being built.",
      chartValueLabel: "Portfolio value",
      chartTotalValue: "Total value",
      chartCapitalInvested: "Capital invested",
      chartProfit: "Profit",
      chartMonthShort: "Month {n}",
      chartMonthSinceFounding: "Month {n} since founding",
      chartInitialCapitalLine: "Initial capital: {amount}",
      chartTitleTemplate: "Portfolio evolution {code}",
      chartSubtitleTemplate: "Total value (NAV) in {ccy}",
      chartMonthDashTemplate: "Month {n} — {month}",
      lastSnapshotAvailable: "Last available snapshot",
      returnSinceFounding: "Return since founding",
      colTicker: "Ticker",
      colWeight: "Initial weight",
      colAvgPrice: "Avg. price",
      colCurrentPrice: "Current price",
      colPl: "Profit/Loss",
      colRisk: "Risk",
      colCategory: "Category",
      colCashAmount: "Amount",
      colCashStatus: "Status",
      colAmount: "Amount",
      colPayDate: "Pay date",
      colType: "Type",
      colDate: "Date",
      positionsHead: "Active positions",
      cashHead: "Cash reserves",
      dividendsHead: "Dividends",
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
      statusReserved: "reserved",
      statusReleased: "released",
      cashCategories: {
        amplification_reserve: "Reserve for position amplification",
        cash_equivalent: "Available cash",
        iwfv_reserved: "Reserved for IWFV",
        spcx_reserved: "Reserved for SpaceX",
        novo_b_reserved: "Reserved for NOVO B",
        buffer_defensiv: "Defensive buffer",
      },
    },
    ru: {
      navHome: "Главная",
      navCabinet: "Кабинет",
      loading: "Загрузка портфелей…",
      lockedTitle: "Премиум-контент",
      lockedText: "Для просмотра полных портфелей нужна активная подписка.",
      lockedCta: "Посмотреть подписки",
      errorTitle: "Ошибка",
      errorText: "Не удалось загрузить портфели. Попробуйте снова.",
      retry: "Повторить",
      eyebrow: "Кабинет",
      title: "Ваши портфели",
      delayedBadge: "Данные с задержкой ~{min}-20 мин",
      syncPartialNote:
        "⚠️ Последняя синхронизация цен была частичной — показаны данные последней полностью успешной синхронизации.",
      returnPending: "Доходность в ожидании (TWR)",
      holdingsValueLabel: "Стоимость позиций (без учёта денежных средств): {amount}",
      lastUpdated: "Последнее обновление:",
      tabUs: "Портфель US",
      tabEu: "Портфель EU",
      fxNote:
        "1 {ccy} = базовая валюта портфеля. Позиции в других валютах конвертируются по последнему курсу, введённому администратором (fx_rates).",
      incompleteNote:
        "⚠️ Начальную долю сейчас нельзя рассчитать для некоторых позиций (отсутствует сделка покупки или нужный курс валюты) — показано как «курс недоступен» вместо приблизительного значения.",
      initialCapital: "Начальный капитал",
      currentValue: "Текущая стоимость",
      profitSince: "Прибыль с основания",
      totalReturn: "Доходность",
      evolution: "Динамика с момента основания",
      chartEmpty: "История доходности формируется.",
      chartValueLabel: "Стоимость портфеля",
      chartTotalValue: "Общая стоимость",
      chartCapitalInvested: "Вложенный капитал",
      chartProfit: "Прибыль",
      chartMonthShort: "Месяц {n}",
      chartMonthSinceFounding: "Месяц {n} с основания",
      chartInitialCapitalLine: "Начальный капитал: {amount}",
      chartTitleTemplate: "Динамика портфеля {code}",
      chartSubtitleTemplate: "Общая стоимость (NAV) в {ccy}",
      chartMonthDashTemplate: "Месяц {n} — {month}",
      lastSnapshotAvailable: "Последний доступный снимок",
      returnSinceFounding: "Доходность с основания",
      colTicker: "Тикер",
      colWeight: "Начальная доля",
      colAvgPrice: "Средняя цена",
      colCurrentPrice: "Текущая цена",
      colPl: "Прибыль/Убыток",
      colRisk: "Риск",
      colCategory: "Категория",
      colCashAmount: "Сумма",
      colCashStatus: "Статус",
      colAmount: "Сумма",
      colPayDate: "Дата выплаты",
      colType: "Тип",
      colDate: "Дата",
      positionsHead: "Активные позиции",
      cashHead: "Резервы наличности",
      dividendsHead: "Дивиденды",
      transactionsHead: "Последние транзакции",
      swipeHint: "← Листайте для просмотра →",
      noData: "Нет доступных данных.",
      cashEmpty: "Резервы наличности не зафиксированы.",
      dividendsEmpty: "Дивиденды пока не зафиксированы.",
      transactionsEmpty: "Транзакции пока не зафиксированы.",
      rateUnavailable: "курс недоступен",
      referencePrice: "справочная цена",
      awaitingLiveData: "Ожидание живых данных",
      disclaimer:
        "Образовательные/демонстрационные данные. Не является инвестиционной консультацией.",
      statusReserved: "зарезервировано",
      statusReleased: "высвобождено",
      cashCategories: {
        amplification_reserve: "Резерв для увеличения позиций",
        cash_equivalent: "Доступные денежные средства",
        iwfv_reserved: "Зарезервировано для IWFV",
        spcx_reserved: "Зарезервировано для SpaceX",
        novo_b_reserved: "Зарезервировано для NOVO B",
        buffer_defensiv: "Защитный буфер",
      },
    },
    uk: {
      navHome: "Головна",
      navCabinet: "Кабінет",
      loading: "Завантаження портфелів…",
      lockedTitle: "Преміум-контент",
      lockedText: "Для перегляду повних портфелів потрібна активна підписка.",
      lockedCta: "Переглянути підписки",
      errorTitle: "Помилка",
      errorText: "Не вдалося завантажити портфелі. Спробуйте ще раз.",
      retry: "Повторити",
      eyebrow: "Кабінет",
      title: "Ваші портфелі",
      delayedBadge: "Дані із затримкою ~{min}-20 хв",
      syncPartialNote:
        "⚠️ Остання синхронізація цін була частковою — показані дані останньої повністю успішної синхронізації.",
      returnPending: "Дохідність очікується (TWR)",
      holdingsValueLabel: "Вартість позицій (без урахування готівки): {amount}",
      lastUpdated: "Останнє оновлення:",
      tabUs: "Портфель US",
      tabEu: "Портфель EU",
      fxNote:
        "1 {ccy} = базова валюта портфеля. Позиції в інших валютах конвертуються за останнім курсом, введеним адміністратором (fx_rates).",
      incompleteNote:
        "⚠️ Початкову частку наразі не можна розрахувати для деяких позицій (відсутня угода купівлі або потрібний курс валюти) — показано як «курс недоступний» замість приблизного значення.",
      initialCapital: "Початковий капітал",
      currentValue: "Поточна вартість",
      profitSince: "Прибуток від заснування",
      totalReturn: "Дохідність",
      evolution: "Динаміка від заснування",
      chartEmpty: "Історія дохідності формується.",
      chartValueLabel: "Вартість портфеля",
      chartTotalValue: "Загальна вартість",
      chartCapitalInvested: "Вкладений капітал",
      chartProfit: "Прибуток",
      chartMonthShort: "Місяць {n}",
      chartMonthSinceFounding: "Місяць {n} від заснування",
      chartInitialCapitalLine: "Початковий капітал: {amount}",
      chartTitleTemplate: "Динаміка портфеля {code}",
      chartSubtitleTemplate: "Загальна вартість (NAV) у {ccy}",
      chartMonthDashTemplate: "Місяць {n} — {month}",
      lastSnapshotAvailable: "Останній доступний знімок",
      returnSinceFounding: "Дохідність від заснування",
      colTicker: "Тікер",
      colWeight: "Початкова частка",
      colAvgPrice: "Середня ціна",
      colCurrentPrice: "Поточна ціна",
      colPl: "Прибуток/Збиток",
      colRisk: "Ризик",
      colCategory: "Категорія",
      colCashAmount: "Сума",
      colCashStatus: "Статус",
      colAmount: "Сума",
      colPayDate: "Дата виплати",
      colType: "Тип",
      colDate: "Дата",
      positionsHead: "Активні позиції",
      cashHead: "Грошові резерви",
      dividendsHead: "Дивіденди",
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
      statusReserved: "зарезервовано",
      statusReleased: "звільнено",
      cashCategories: {
        amplification_reserve: "Резерв для збільшення позицій",
        cash_equivalent: "Доступні грошові кошти",
        iwfv_reserved: "Зарезервовано для IWFV",
        spcx_reserved: "Зарезервовано для SpaceX",
        novo_b_reserved: "Зарезервовано для NOVO B",
        buffer_defensiv: "Захисний буфер",
      },
    },
    pl: {
      navHome: "Strona główna",
      navCabinet: "Panel",
      loading: "Wczytywanie portfeli…",
      lockedTitle: "Treść premium",
      lockedText: "Potrzebujesz aktywnej subskrypcji, aby zobaczyć pełne portfele.",
      lockedCta: "Zobacz subskrypcje",
      errorTitle: "Błąd",
      errorText: "Nie udało się wczytać portfeli. Spróbuj ponownie.",
      retry: "Ponów",
      eyebrow: "Panel",
      title: "Twoje portfele",
      delayedBadge: "Dane opóźnione ~{min}-20 min",
      syncPartialNote:
        "⚠️ Ostatnia synchronizacja cen była częściowa — wyświetlane dane pochodzą z ostatniej w pełni udanej synchronizacji.",
      returnPending: "Zwrot w trakcie obliczania (TWR)",
      holdingsValueLabel: "Wartość pozycji (bez gotówki): {amount}",
      lastUpdated: "Ostatnia aktualizacja:",
      tabUs: "Portfel US",
      tabEu: "Portfel EU",
      fxNote:
        "1 {ccy} = waluta bazowa portfela. Pozycje w innych walutach są przeliczane po najnowszym kursie wprowadzonym przez administratora (fx_rates).",
      incompleteNote:
        "⚠️ Wagi początkowej nie można obecnie obliczyć dla niektórych pozycji (brak transakcji zakupu lub potrzebnego kursu walutowego) — pokazane jako „kurs niedostępny” zamiast wartości przybliżonej.",
      initialCapital: "Kapitał początkowy",
      currentValue: "Wartość bieżąca",
      profitSince: "Zysk od założenia",
      totalReturn: "Stopa zwrotu",
      evolution: "Wyniki od założenia",
      chartEmpty: "Historia wyników jest budowana.",
      chartValueLabel: "Wartość portfela",
      chartTotalValue: "Wartość całkowita",
      chartCapitalInvested: "Zainwestowany kapitał",
      chartProfit: "Zysk",
      chartMonthShort: "Miesiąc {n}",
      chartMonthSinceFounding: "Miesiąc {n} od założenia",
      chartInitialCapitalLine: "Kapitał początkowy: {amount}",
      chartTitleTemplate: "Ewolucja portfela {code}",
      chartSubtitleTemplate: "Wartość całkowita (NAV) w {ccy}",
      chartMonthDashTemplate: "Miesiąc {n} — {month}",
      lastSnapshotAvailable: "Ostatni dostępny zrzut",
      returnSinceFounding: "Stopa zwrotu od założenia",
      colTicker: "Ticker",
      colWeight: "Waga początkowa",
      colAvgPrice: "Śr. cena",
      colCurrentPrice: "Cena bieżąca",
      colPl: "Zysk/Strata",
      colRisk: "Ryzyko",
      colCategory: "Kategoria",
      colCashAmount: "Kwota",
      colCashStatus: "Status",
      colAmount: "Kwota",
      colPayDate: "Data wypłaty",
      colType: "Typ",
      colDate: "Data",
      positionsHead: "Aktywne pozycje",
      cashHead: "Rezerwy gotówkowe",
      dividendsHead: "Dywidendy",
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
      statusReserved: "zarezerwowane",
      statusReleased: "zwolnione",
      cashCategories: {
        amplification_reserve: "Rezerwa na zwiększenie pozycji",
        cash_equivalent: "Dostępna gotówka",
        iwfv_reserved: "Zarezerwowane dla IWFV",
        spcx_reserved: "Zarezerwowane dla SpaceX",
        novo_b_reserved: "Zarezerwowane dla NOVO B",
        buffer_defensiv: "Bufor defensywny",
      },
    },
  };

  function t(key) {
    var dict = I18N[STATE.lang] || I18N.ro;
    return dict[key] || I18N.ro[key] || key;
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
    } catch (e) {
      /* ignore */
    }
    return "ro";
  }

  function setLang(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
    STATE.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      /* ignore */
    }
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
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
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
    // (2026-08-14, Etapa 4 - EODHD Live Delayed) Badge-ul afiseaza acum
    // intervalul real de intarziere al furnizorului (~15-20 min),
    // interpolat din STATE.delayedDataMinutes (primit de la API, vezi
    // loadPortfolios) in sablonul I18N "delayedBadge" ({min}) - acelasi
    // tipar ca mpFxNote (.replace("{ccy}", ...)).
    var delayedBadge = document.getElementById("mpDelayedBadge");
    if (delayedBadge) {
      delayedBadge.textContent = t("delayedBadge").replace("{min}", STATE.delayedDataMinutes);
    }
    document.documentElement.lang = STATE.lang;
  }

  /* ------------------------------------------------------------------ */
  /* Header interactivity (self-contained, mirrors index.html) */
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
      if (langSwitcher) {
        langSwitcher.classList.remove("is-open");
        if (langBtn) langBtn.setAttribute("aria-expanded", "false");
      }
      if (accountDropdown) {
        accountDropdown.classList.remove("is-open");
        if (memberBtn) memberBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Formatting helpers */
  /* ------------------------------------------------------------------ */
  var CCY_SYMBOLS = { GBP: "£", EUR: "€", USD: "$", CHF: "CHF ", SEK: "SEK ", DKK: "DKK " };

  function fmtMoney(amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
    var sign = amount < 0 ? "-" : "";
    return (
      sign +
      symbol +
      Math.abs(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
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
      return new Date(iso).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return iso;
    }
  }

  // Aceeasi data ca fmtDate, dar cu numele lunii intreg ("31 iulie 2026", nu
  // "31 iul. 2026") - folosita STRICT in tooltip-ul graficului si in eticheta
  // ultimului punct (renderChart mai jos), unde formatul lung a fost cerut
  // explicit. Restul paginii (randuri de tranzactii/dividende, "Ultima
  // actualizare") ramane pe fmtDate (luna scurta) ca sa nu schimbe afisaje
  // existente, deja verificate, in afara scopului acestei cereri.
  function fmtDateLong(iso) {
    if (!iso) return "—";
    try {
      var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
      return new Date(iso).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return iso;
    }
  }

  // Numele lunii calendaristice + anul punctului, cu prima litera majuscula
  // ("Mai 2026", nu "mai 2026" cum returneaza implicit toLocaleDateString
  // pentru ro-RO/ru-RU/etc.) - folosit STRICT pentru a doua linie a
  // etichetelor axei X ale graficului (vezi drawChart / cerinta axei X:
  // "Luna 1" + "Mai 2026").
  function fmtMonthYear(iso) {
    if (!iso) return "—";
    try {
      var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
      var s = new Date(iso + "T00:00:00").toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) {
      return iso;
    }
  }

  // Numarul "lunii de la fondare" (1-based) pentru o data, ancorat la ZIUA
  // exacta a fondarii - NU la inceputul lunii calendaristice. "Luna 1"
  // incepe chiar in ziua fondarii si tine pana (exclusiv) aceeasi zi din
  // luna urmatoare; "Luna 2" incepe atunci etc. (bucket-uri lunare "rulante",
  // ancorate la data fondarii - cerinta explicita a axei X).
  //
  // Verificat manual fata de exemplul primit: monthsSinceFounding
  // ("2026-05-07", "2026-07-31") => 3 ("Luna 3 de la fondare"), exact ca in
  // exemplul de tooltip cerut pentru portofoliul US.
  function monthsSinceFounding(foundingIso, dateIso) {
    var f = new Date(foundingIso + "T00:00:00");
    var d = new Date(dateIso + "T00:00:00");
    var months = (d.getFullYear() - f.getFullYear()) * 12 + (d.getMonth() - f.getMonth());
    if (d.getDate() < f.getDate()) months -= 1;
    if (months < 0) months = 0;
    return months + 1;
  }

  // Inlocuieste "{n}"/"{amount}" etc. intr-un sablon de traducere - folosit
  // pentru textele noi ale graficului ("Luna {n}", "Capital inițial:
  // {amount}") ca sa nu presaram concatenari manuale peste tot.
  function tfmt(key, params) {
    var s = t(key);
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) {
        s = s.split("{" + k + "}").join(params[k]);
      }
    }
    return s;
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
      return new Date(iso).toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  // Suma formatata cu separatorul de mii/zecimale al limbii curente (nu
  // locale-ul implicit al browserului, ca fmtMoney - vezi nota din
  // renderChart despre de ce graficul foloseste un formator dedicat).
  function fmtMoneyLocale(amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
    var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
    return (
      symbol +
      Math.abs(amount).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  // Varianta compacta (fara zecimale) pentru etichetele axei verticale a
  // graficului - "£10.605", nu "£10.604,89". Doar pentru lizibilitate pe axa;
  // tooltip-ul si eticheta ultimului punct folosesc in continuare
  // fmtMoneyLocale (2 zecimale).
  function fmtMoneyAxis(amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
    var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
    return symbol + Math.round(amount).toLocaleString(locale);
  }

  // Suma cu semn explicit (+ / minus tipografic "−", nu cratima "-") si
  // culoare neutra la exact 0 - folosita pentru profitul afisat in tooltip-ul
  // graficului (cerinta 4: verde+"+" la pozitiv, rosu+"−" la negativ, neutru
  // la zero).
  function fmtSignedMoney(amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
    var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
    var abs = Math.abs(amount).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (amount > 0) return "+" + symbol + abs;
    if (amount < 0) return "−" + symbol + abs;
    return symbol + abs;
  }

  // Procent cu semn explicit (+ / "−" tipografic), acelasi tipar ca
  // fmtSignedMoney - folosit pentru randamentul cumulativ afisat in tooltip
  // si in eticheta ultimului punct.
  //
  // Locale-aware (foloseste separatorul zecimal al limbii curente, ex. "," la
  // ro-RO -> "+2,98%") - NU toFixed() simplu (care ar da mereu "." indiferent
  // de limba), ca sa se potriveasca exact cu exemplul cerut ("+2,98%", nu
  // "+2.98%") pentru randamentul din tooltip-ul graficului si eticheta
  // ultimului punct.
  function fmtSignedPct(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return "—";
    var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
    var abs =
      Math.abs(pct).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      "%";
    if (pct > 0) return "+" + abs;
    if (pct < 0) return "−" + abs;
    return abs;
  }

  // Clasa CSS pentru culoarea unei valori semnate (profit/randament):
  // verde la pozitiv, rosu la negativ, neutru (culoarea muted a site-ului)
  // la exact zero - cerinta 4.
  function signClass(value) {
    if (value === null || value === undefined || isNaN(value)) return "mp-chart-neutral";
    if (value > 0) return "mp-chart-pos";
    if (value < 0) return "mp-chart-neg";
    return "mp-chart-neutral";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------ */
  /* State switching */
  /* ------------------------------------------------------------------ */
  function showState(name) {
    ["mpStateLoading", "mpStateLocked", "mpStateError", "mpStateDashboard"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== name;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Auth + data loading */
  /* ------------------------------------------------------------------ */
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function redirectToLogin() {
    window.location.href = "index.html#account";
  }

  function loadEmailHeader(token) {
    fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (res) {
        var emailEl = document.getElementById("mpMemberEmail");
        if (emailEl && res.ok && res.data && res.data.success && res.data.email) {
          emailEl.textContent = res.data.email;
        }
      })
      .catch(function () {});
  }

  // Etapa 4 (EODHD Live Delayed), cerinta 15: refresh discret la 60s, DOAR
  // cat timp pagina e vizibila - vezi startPolling/stopPolling mai jos.
  // isBackgroundRefresh: true la reincercarile din polling/revenire pe tab,
  // ca sa NU trecem prin ecranul de "Se incarca..." (STATE.portfolios ramane
  // afisat neschimbat pana sosesc datele noi - un refresh silentios, nu un
  // reload vizibil la fiecare minut).
  function loadPortfolios(isBackgroundRefresh) {
    var token = getToken();
    STATE.token = token;
    if (!token) {
      redirectToLogin();
      return;
    }
    if (STATE.loading) return; // evita cereri suprapuse (poll + retry manual etc.)
    STATE.loading = true;

    if (!isBackgroundRefresh) {
      showState("mpStateLoading");
    }
    loadEmailHeader(token);

    fetch("/api/account-portfolios", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        STATE.loading = false;
        if (res.status === 401) {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch (e) {
            /* ignore */
          }
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
        if (!isBackgroundRefresh) showState("mpStateError");
      })
      .catch(function () {
        STATE.loading = false;
        if (!isBackgroundRefresh) showState("mpStateError");
      });
  }

  var POLL_INTERVAL_MS = 60000;
  var pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (document.visibilityState === "visible" && STATE.token) {
        loadPortfolios(true);
      }
    }, POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (STATE.token) loadPortfolios(true); // refresh imediat la revenirea pe tab, nu doar la urmatorul tick de 60s
      startPolling();
    } else {
      stopPolling();
    }
  });

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
    } catch (e) {
      /* ignore */
    }

    // Redeseneaza graficul curent la redimensionare/rotire ecran (debounced) -
    // axele si pozitiile tooltip-ului depind de latimea/inaltimea reala in
    // pixeli a #mpChartWrap (vezi drawChart), nu doar de viewBox-ul SVG, deci
    // trebuie recalculate cand containerul isi schimba dimensiunea (ex.
    // rotire telefon portret/landscape, redimensionare fereastra desktop).
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (STATE.chartPoints && STATE.chartPoints.length >= 2 && STATE.chartMeta) {
          var wrap = document.getElementById("mpChartWrap");
          if (wrap && !wrap.hidden) drawChart(wrap, STATE.chartPoints, STATE.chartMeta);
        }
      }, 150);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering */
  /* ------------------------------------------------------------------ */
  function renderActiveTab() {
    if (!STATE.portfolios) return;
    var p = STATE.portfolios.filter(function (x) {
      return x.code === STATE.activeCode;
    })[0];

    var updatedEl = document.getElementById("mpUpdatedAt");
    if (updatedEl) {
      updatedEl.textContent =
        p && p.lastUpdatedAt
          ? t("lastUpdated") + " " + fmtDateTime(p.lastUpdatedAt)
          : t("lastUpdated") + " —";
    }

    var fxNote = document.getElementById("mpFxNote");
    if (fxNote) fxNote.textContent = p ? t("fxNote").replace("{ccy}", p.baseCurrency) : "";

    // Etapa 4: valoarea NUMAI a pozitiilor (holdingsValueBaseCcy), distincta
    // de NAV-ul total afisat in cardul "Ultimul instantaneu disponibil"
    // (care include si cash-ul din ledger) - vezi api/account-portfolios.js.
    // Afisata doar cand e cunoscuta (nu si "0"/o valoare inventata).
    var holdingsNote = document.getElementById("mpHoldingsNote");
    if (holdingsNote) {
      var hasHoldingsValue = !!(p && p.holdingsValueBaseCcy != null);
      holdingsNote.hidden = !hasHoldingsValue;
      if (hasHoldingsValue) {
        holdingsNote.textContent = t("holdingsValueLabel").replace(
          "{amount}",
          fmtMoney(p.holdingsValueBaseCcy, p.baseCurrency),
        );
      }
    }

    var incompleteNote = document.getElementById("mpIncompleteNote");
    if (incompleteNote) {
      // Banner-ul e legat de "Pondere initiala" (initialWeightsComplete),
      // nu de vechiul dataComplete (bazat pe pretul curent) - vezi
      // api/account-portfolios.js.
      var incomplete = !!(p && p.initialWeightsComplete === false);
      incompleteNote.hidden = !incomplete;
      if (incomplete) incompleteNote.textContent = t("incompleteNote");
    }

    // Etapa 4: banner distinct pentru "ultima rulare de sincronizare a fost
    // partiala" (p.lastSyncStatus) - NU acelasi concept ca mpIncompleteNote
    // (care e despre pondere initiala/curs istoric). wasPartial acopera atat
    // 'partial' (simbol/pret lipsa sau stale) cat si 'fetch_failed' (EODHD
    // inaccesibil) - in ambele cazuri datele afisate raman din ultima
    // sincronizare reusita, niciodata date partiale publicate.
    var syncPartialNote = document.getElementById("mpSyncPartialNote");
    if (syncPartialNote) {
      var wasPartial = !!(p && p.lastSyncStatus && p.lastSyncStatus.wasPartial);
      syncPartialNote.hidden = !wasPartial;
      if (wasPartial) syncPartialNote.textContent = t("syncPartialNote");
    }

    renderStatCards(p);
    renderChart(p);
    renderPositions(p ? p.positions : [], p ? p.baseCurrency : null);
    renderCashReserves(p ? p.cashReserves : [], p ? p.baseCurrency : null);
    renderDividends(p ? p.dividends : []);
    renderTransactions(p ? p.transactions : []);
  }

  // Cardul unui rand de sumar cu iconita circulara (2026-08-05, redesign) -
  // vezi renderStatCards() mai jos. `sub` (optional) e o a doua linie mica
  // sub valoare (folosita STRICT pentru data instantaneului la cardul
  // "Ultimul instantaneu disponibil" - cerinta 2), niciodata generata pentru
  // celelalte doua carduri.
  function statCard3Html(iconId, iconCls, label, value, valCls, sub, pending) {
    var valueCls =
      "mp-stat-value" + (valCls ? " " + valCls : "") + (pending ? " mp-stat-val-pending" : "");
    return (
      '<div class="mp-stat-card">' +
      '<div class="mp-stat-icon ' +
      iconCls +
      '"><svg class="mp-stat-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#' +
      iconId +
      '"></use></svg></div>' +
      '<div class="mp-stat-body">' +
      '<div class="mp-stat-label">' +
      esc(label) +
      '</div><div class="' +
      valueCls +
      '">' +
      esc(value) +
      "</div>" +
      (sub ? '<div class="mp-stat-sub">' + esc(sub) + "</div>" : "") +
      "</div></div>"
    );
  }

  // Exact 3 carduri de sumar (cerinta 2, redesign 2026-08-05): Capital
  // inițial (auriu), Ultimul instantaneu disponibil (alb-argintiu) și
  // Randament de la fondare (verde/roșu) - TOATE trei calculate din
  // p.initialCapital / ultimul rand din p.performanceHistory, niciodata din
  // campurile conditionate de p.hasLivePriceData (acelea raman strict pentru
  // "Valoare actuala" bazata pe pret curent, care NU mai apare pe acest
  // card - cerinta 8: "Valoare actuala" ramane separata de istoricul NAV).
  // Daca performanceHistory e gol (portofoliu foarte nou, inainte de primul
  // instantaneu), cardurile 2-3 afiseaza explicit "In asteptarea datelor
  // live", niciodata 0 sau o valoare inventata.
  function renderStatCards(p) {
    var el = document.getElementById("mpStatsCards");
    if (!el) return;
    if (!p) {
      el.innerHTML = '<p class="portfolio-empty-note">' + esc(t("noData")) + "</p>";
      return;
    }
    var history = p.performanceHistory || [];
    var last = history.length ? history[history.length - 1] : null;
    var lastMetrics = last ? computePointMetrics(last) : null;
    // Etapa 4, cerinta 13: p.totalReturnPct e autoritatea LIVE (calculata
    // din ledger la fiecare cerere, vezi api/account-portfolios.js) - daca
    // valoarea e string-ul 'pending' (a existat un DEPOSIT/WITHDRAWAL dupa
    // fondare), randamentul simplu din istoric NU mai e afisat ca numar,
    // indiferent ce contine ultimul rand din performanceHistory.
    var isReturnPending = p.totalReturnPct === "pending";
    var returnPct = isReturnPending ? null : lastMetrics ? lastMetrics.returnPct : null;
    var returnSign = signClass(returnPct);
    var returnIconCls =
      returnSign === "mp-chart-pos"
        ? "mp-stat-icon-green"
        : returnSign === "mp-chart-neg"
          ? "mp-stat-icon-red"
          : "mp-stat-icon-silver";
    var returnValCls =
      returnSign === "mp-chart-pos"
        ? "mp-stat-val-green"
        : returnSign === "mp-chart-neg"
          ? "mp-stat-val-red"
          : "";

    el.innerHTML = [
      statCard3Html(
        "mp-icon-coin",
        "mp-stat-icon-gold",
        t("initialCapital"),
        fmtMoney(p.initialCapital, p.baseCurrency),
        "mp-stat-val-gold",
        null,
        false,
      ),
      statCard3Html(
        "mp-icon-clock",
        "mp-stat-icon-silver",
        t("lastSnapshotAvailable"),
        last ? fmtMoney(last.navValue, p.baseCurrency) : t("awaitingLiveData"),
        "mp-stat-val-silver",
        last ? fmtDateLong(last.asOfDate) : null,
        !last,
      ),
      statCard3Html(
        "mp-icon-trend",
        returnIconCls,
        t("returnSinceFounding"),
        isReturnPending
          ? t("returnPending")
          : returnPct != null
            ? fmtSignedPct(returnPct)
            : t("awaitingLiveData"),
        returnValCls,
        null,
        isReturnPending || returnPct == null,
      ),
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
    return history.filter(function (h) {
      return new Date(h.asOfDate) >= cutoff;
    });
  }

  // Alege cel mult `count` indici din [0, n-1], distribuiti cat mai uniform,
  // incluzand mereu primul si ultimul - folosita pentru etichetele axei
  // orizontale (data), ca sa nu se suprapuna cand sunt multe instantanee
  // (cerinta 5: "pe mobil poti afisa mai putine etichete... dar toate
  // punctele trebuie sa ramana accesibile prin atingere" - aceasta functie
  // alege DOAR ce se ETICHETEAZA vizual; punctele in sine (cercurile-tinta
  // pentru hover/tap din drawChart) raman toate, indiferent de count).
  function pickEvenIndices(n, count) {
    if (n <= 0) return [];
    if (n <= count || count <= 1) {
      var all = [];
      for (var i = 0; i < n; i++) all.push(i);
      return count <= 1
        ? [0, n - 1].filter(function (v, idx, arr) {
            return arr.indexOf(v) === idx;
          })
        : all;
    }
    var idx = [];
    for (var k = 0; k < count; k++) {
      idx.push(Math.round((k * (n - 1)) / (count - 1)));
    }
    return idx.filter(function (v, i, arr) {
      return arr.indexOf(v) === i;
    });
  }

  // Calculeaza profitul/pierderea pentru un instantaneu si respecta starea
  // persistata a randamentului:
  // profit_pierdere = nav_value - capital_contributed
  // return_is_pending=true interzice orice recalculare in browser. Cand
  // este false, singura valoare afisabila este cumulative_return_pct deja
  // validata/persistata de snapshotul atomic; null ramane null.
  function computePointMetrics(h) {
    var nav = h.navValue;
    var capital = h.capitalContributed;
    var profitLoss = nav != null && capital != null ? nav - capital : null;
    var dbPct =
      h.cumulativeReturnPct === null || h.cumulativeReturnPct === undefined
        ? null
        : Number(h.cumulativeReturnPct);
    var returnPct = !h.returnIsPending && Number.isFinite(dbPct) ? dbPct : null;
    return { profitLoss: profitLoss, returnPct: returnPct };
  }

  function pointReturnText(h, metrics) {
    return h && h.returnIsPending ? t("returnPending") : fmtSignedPct(metrics ? metrics.returnPct : null);
  }

  // Grafic in SVG inline vanilla JS - fara librarie externa, ca sa nu fie
  // nevoie sa extindem CSP script-src (vezi vercel.json). Cand nu sunt
  // suficiente puncte (nevoie de minim 2 instantanee reale din
  // portfolio_performance_history), afisam un card compact in loc de grafic.
  //
  // Nota (2026-08-05): rescris ca sa adauge - la cerere explicita - tooltip
  // pe hover/tap per punct (data, NAV, profit fata de capitalul initial,
  // randament cumulativ), axa verticala (NAV in moneda portofoliului) si
  // axa orizontala (date, cu etichete rarite pe ecrane inguste - vezi
  // pickEvenIndices), plus evidentierea ultimului punct (NAV/randament/data
  // afisate permanent langa el, nu doar pe hover). Nimic din acestea nu
  // foloseste cuvantul "live" - sunt instantanee istorice din
  // portfolio_performance_history, nu date de piata in timp real.
  //
  // Nota (2026-07-30, hotfix, inca valabila): #mpChartWrap avea
  // min-height:320px in CSS (vezi member-portfolios.css) indiferent daca
  // era gol sau nu - cand filtered.length < 2, doar innerHTML era golit,
  // dar elementul tot ocupa 320px goi pe ecran, DEASUPRA cardului compact
  // #mpChartEmpty. Fix (neschimbat): ascunde explicit #mpChartWrap
  // (atributul hidden => display:none) cat timp nu are ce desena.
  //
  // Nota (2026-08-05, actualizare axe): rescris din nou ca sa adauge axe
  // "profesionale": axa X grupata pe luni de la fondare (nu pe fiecare
  // instantaneu in parte - vezi computeMonthGroups/monthsSinceFounding),
  // axa Y cu paranj dinamic (nu neaparat de la zero) care include si linia
  // capitalului initial, o linie orizontala punctata pentru capitalul
  // initial cu zona de profit (verde, deasupra liniei) si de pierdere
  // (rosu, dedesubt) si un tooltip extins la 6 randuri (data, luna de la
  // fondare, valoare totala, capital investit, profit, randament).
  // Titlu + subtitlu dinamice ale cardului graficului (cerinta 3, redesign
  // 2026-08-05): "Evoluție portofoliu US/EU" (majuscule aurii, mostenite din
  // CSS) + "Valoare totală (NAV) în GBP/EUR" - ambele derivate din
  // portofoliul activ (p.code / p.baseCurrency), nu texte statice fixe. Cat
  // timp portofoliul nu e inca disponibil (p null - stare initiala de
  // incarcare), titlul ramane pe eticheta generica (deja setata de
  // applyStaticTexts) si subtitlul ramane ascuns.
  function updateChartHeader(p) {
    var titleEl = document.getElementById("mpEvolutionLabel");
    var subEl = document.getElementById("mpEvolutionSubtitle");
    if (titleEl) {
      titleEl.textContent =
        p && p.code ? tfmt("chartTitleTemplate", { code: p.code }) : t("evolution");
    }
    if (subEl) {
      if (p && p.baseCurrency) {
        subEl.textContent = tfmt("chartSubtitleTemplate", { ccy: p.baseCurrency });
        subEl.hidden = false;
      } else {
        subEl.hidden = true;
      }
    }
  }

  function renderChart(p) {
    var wrap = document.getElementById("mpChartWrap");
    var emptyEl = document.getElementById("mpChartEmpty");
    if (!wrap) return;

    updateChartHeader(p);

    var history = p ? p.performanceHistory : [];
    var filtered = filterHistoryByInterval(history, STATE.activeInterval);
    if (!p || !filtered || filtered.length < 2) {
      STATE.chartPoints = null;
      STATE.chartMeta = null;
      wrap.innerHTML = "";
      wrap.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    wrap.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    // Capitalul initial de referinta pentru linia orizontala (cerinta 3):
    // preferam p.initialCapital (campul portofoliului, stabil indiferent de
    // interval) si folosim capitalContributed al primului instantaneu doar
    // ca fallback, daca dintr-un motiv neasteptat p.initialCapital lipseste.
    var capital =
      p.initialCapital != null
        ? p.initialCapital
        : filtered[0]
          ? filtered[0].capitalContributed
          : null;
    var meta = {
      code: p.code,
      currency: p.baseCurrency || (filtered[0] ? filtered[0].currency : null),
      capital: capital,
      founded: FOUNDING_DATES[p.code] || null,
    };

    STATE.chartPoints = filtered;
    STATE.chartMeta = meta;
    drawChart(wrap, filtered, meta);
  }

  // Grupeaza instantaneele filtrate pe "luni de la fondare" (bucket-uri
  // ancorate la data fondarii - vezi monthsSinceFounding), pastrand DOAR
  // primul instantaneu din fiecare luna ca reprezentant pentru eticheta de
  // pe axa X - asa se garanteaza ca nicio luna calendaristica nu apare de
  // doua ori pe axa (cerinta axei X), desi toate instantaneele raman puncte
  // distincte, interactive, in grafic (vezi pts/circlesSvg in drawChart,
  // care foloseste TOATE punctele din `filtered`, nu doar grupurile).
  function computeMonthGroups(founded, filtered) {
    if (!founded) {
      return filtered.map(function (h, i) {
        return { monthIndex: i + 1, idx: i, iso: h.asOfDate };
      });
    }
    var groups = [];
    var lastMonth = null;
    for (var i = 0; i < filtered.length; i++) {
      var mIdx = monthsSinceFounding(founded, filtered[i].asOfDate);
      if (mIdx !== lastMonth) {
        groups.push({ monthIndex: mIdx, idx: i, iso: filtered[i].asOfDate });
        lastMonth = mIdx;
      }
    }
    return groups;
  }

  // Deseneaza graficul propriu-zis (SVG + supraetajul HTML pentru axe,
  // linia capitalului initial, tooltip si eticheta ultimului punct)
  // intr-un container deja validat (minim 2 puncte). Separata de
  // renderChart ca sa poata fi rechemata si la resize/rotire ecran, fara sa
  // refiltreze istoricul (vezi wireDashboardControlsOnce -> window resize
  // listener), folosind STATE.chartMeta salvat de renderChart.
  // Latimea reala (in pixeli CSS) a unui text randat cu un anumit font,
  // folosind un <canvas> offscreen (2D Text Metrics) - mult mai precisa
  // decat o estimare pe baza numarului de caractere, folosita ca sa rareasca
  // corect etichetele axei X (vezi drawChart -> candidates/keptTicks) fara
  // sa le suprapuna, indiferent de limba activa (unele traduceri, ex. luni
  // in rusa/ucraineana, sunt semnificativ mai lungi decat originalul RO).
  function measureTextWidth(text, fontSpec) {
    try {
      if (!measureTextWidth._ctx) {
        measureTextWidth._ctx = document.createElement("canvas").getContext("2d");
      }
      if (measureTextWidth._ctx) {
        measureTextWidth._ctx.font = fontSpec;
        return measureTextWidth._ctx.measureText(text).width;
      }
    } catch (e) {
      /* ignore - fallback mai jos */
    }
    return text.length * 6.5;
  }

  // "Nice numbers" pentru pasul intre repere (algoritm standard, Heckbert) -
  // vezi computeNiceTicks() mai jos.
  function niceNum(range, round) {
    if (!isFinite(range) || range <= 0) return 1;
    var exponent = Math.floor(Math.log10(range));
    var fraction = range / Math.pow(10, exponent);
    var niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  // Repere ("nice numbers") rotunde pentru axa Y (2026-08-05, redesign) -
  // inlocuieste vechile repere prin interpolare liniara bruta (care puteau
  // produce valori neregulate, ex. "£10.032") cu valori rotunde, previzibile
  // (ex. "£10.000", "£10.200"), asa cum apar in referinta vizuala. Extinde
  // usor domeniul brut primit (deja cu padding) ca sa acopere un numar
  // intreg de pasi rotunzi - niciun punct de date sau linia capitalului nu
  // raman in afara acestui domeniu (vezi apelul din drawChart mai jos).
  function computeNiceTicks(rawMin, rawMax, tickCount) {
    if (rawMin === rawMax) {
      rawMin -= 1;
      rawMax += 1;
    }
    var range = niceNum(rawMax - rawMin, false);
    var step = niceNum(range / Math.max(1, tickCount - 1), true);
    var niceMin = Math.floor(rawMin / step) * step;
    var niceMax = Math.ceil(rawMax / step) * step;
    var ticks = [];
    for (var v = niceMin; v <= niceMax + step / 2 && ticks.length < 12; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return { min: niceMin, max: niceMax, step: step, ticks: ticks };
  }

  // Culoarea unui punct/segment fata de linia capitalului initial (verde la
  // sau peste capital, rosu sub el) - cerinta 6/7: aria de profit/pierdere
  // trebuie sa se reflecte si in linia/punctele graficului, nu doar in
  // umplerea de fundal.
  var CAPITAL_ABOVE_COLOR = "#18d98b";
  var CAPITAL_BELOW_COLOR = "#ff4056";
  function sideColor(value, capitalValue) {
    return value >= capitalValue ? CAPITAL_ABOVE_COLOR : CAPITAL_BELOW_COLOR;
  }

  // Sparge polilinia in segmente individuale colorate fata de capitalValue,
  // interpoland liniar (in valoare, nu doar pe cel mai apropiat punct)
  // coordonata exacta unde segmentul traverseaza linia capitalului - cerinta
  // 7 ("linia trebuie sa isi schimbe culoarea exact la intersectie, nu doar
  // sa fie colorata pe bucati intregi intre puncte").
  function buildColoredSegments(pts, capitalValue) {
    var segs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i],
        p1 = pts[i + 1];
      var v0 = p0.h.navValue,
        v1 = p1.h.navValue;
      var side0 = v0 >= capitalValue,
        side1 = v1 >= capitalValue;
      if (side0 === side1 || v1 === v0) {
        segs.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, color: sideColor(v0, capitalValue) });
      } else {
        var frac = (capitalValue - v0) / (v1 - v0);
        var crossX = p0.x + frac * (p1.x - p0.x);
        var crossY = p0.y + frac * (p1.y - p0.y);
        segs.push({
          x1: p0.x,
          y1: p0.y,
          x2: crossX,
          y2: crossY,
          color: sideColor(v0, capitalValue),
        });
        segs.push({
          x1: crossX,
          y1: crossY,
          x2: p1.x,
          y2: p1.y,
          color: sideColor(v1, capitalValue),
        });
      }
    }
    return segs;
  }

  function drawChart(wrap, filtered, meta) {
    var W = 1000,
      H = 280,
      PAD = 10;
    var currency = meta.currency;
    var capitalValue = meta.capital;
    var founded = meta.founded;

    var values = filtered.map(function (h) {
      return h.navValue;
    });
    var rawMin = Math.min.apply(null, values),
      rawMax = Math.max.apply(null, values);
    // Domeniul axei Y include si valoarea capitalului initial (ca linia lui
    // orizontala sa fie mereu vizibila in grafic, nu doar cand NAV-ul e deja
    // aproape de ea) si NU incepe neaparat de la zero (cerinta axei Y:
    // variatiile trebuie sa ramana vizibile) - plus un padding "rezonabil"
    // (10% din plaja) sus si jos, ca linia si punctele sa nu fie lipite de
    // marginile graficului, apoi rotunjit la repere intregi ("nice numbers"
    // - vezi computeNiceTicks) ca axa sa afiseze valori precum "£10.000",
    // "£10.200", nu cifre brute interpolate.
    var domainMin = capitalValue != null ? Math.min(rawMin, capitalValue) : rawMin;
    var domainMax = capitalValue != null ? Math.max(rawMax, capitalValue) : rawMax;
    if (domainMin === domainMax) {
      domainMin -= 100;
      domainMax += 100;
    }
    var span = domainMax - domainMin;
    var padY = span * 0.1;
    var yTickCount = 4;
    var nice = computeNiceTicks(domainMin - padY, domainMax + padY, yTickCount);
    var min = nice.min,
      max = nice.max;

    var innerH = H - PAD * 2;
    var stepX = (W - PAD * 2) / (filtered.length - 1);

    function xFor(i) {
      return PAD + i * stepX;
    }
    function yFor(v) {
      return H - PAD - ((v - min) / (max - min)) * innerH;
    }

    var pts = filtered.map(function (h, i) {
      var x = xFor(i),
        y = yFor(h.navValue);
      return { i: i, x: x, y: y, xPct: (x / W) * 100, yPct: (y / H) * 100, h: h };
    });

    // --- grupuri "luni de la fondare" (cerinta axei X) si rarirea lor -
    // calculate DEVREME, inaintea desenarii SVG-ului, pentru ca acum sunt
    // refolosite si de gridline-urile verticale (cerinta 3/6: linii de
    // grila punctate la graniitele lunilor).
    //
    // Nota (2026-08-05, redesign - eticheta pe o singura linie): rarirea nu
    // se mai face dupa o distanta FIXA intre ancore (insuficienta acum ca
    // eticheta combina "Luna N — luna calendaristica" pe un singur rand,
    // mult mai lata decat vechiul format pe 2 randuri), ci masurand latimea
    // REALA a textului fiecarei etichete (canvas 2D, vezi measureTextWidth)
    // si pastrand o eticheta noua doar daca "amprenta" ei vizuala (stanga-
    // dreapta, tinand cont de alinierea stanga/centru/dreapta fata de
    // ancora) nu se suprapune cu a ultimei etichete pastrate. Ultima luna e
    // mereu pastrata (inlocuind eventual eticheta anterioara, daca s-ar
    // suprapune), ca sa ramana mereu vizibila luna cea mai recenta.
    var groups = computeMonthGroups(founded, filtered);
    var wrapWidth = wrap.clientWidth || 760;
    var xtickFontPx = wrapWidth <= 420 ? 9.5 : 10.5;
    var xtickFont = "700 " + xtickFontPx + 'px -apple-system, "Segoe UI", Arial, sans-serif';
    // Aproximeaza latimea zonei de desenat (fara coloana axei Y) - o mica
    // subestimare aici e sigura (duce doar la o rarire usor mai agresiva,
    // niciodata la suprapunere).
    var plotWidthPx = Math.max(1, wrapWidth - 70);
    var labelGapPx = 10;
    var gapPct = (labelGapPx / plotWidthPx) * 100;
    var candidates = groups.map(function (g, gi) {
      var p = pts[g.idx];
      var label = tfmt("chartMonthDashTemplate", { n: g.monthIndex, month: fmtMonthYear(g.iso) });
      var widthPct = (measureTextWidth(label, xtickFont) / plotWidthPx) * 100;
      var align = p.xPct < 15 ? "left" : p.xPct > 85 ? "right" : "center";
      var leftEdge, rightEdge;
      if (align === "left") {
        leftEdge = p.xPct;
        rightEdge = p.xPct + widthPct;
      } else if (align === "right") {
        leftEdge = p.xPct - widthPct;
        rightEdge = p.xPct;
      } else {
        leftEdge = p.xPct - widthPct / 2;
        rightEdge = p.xPct + widthPct / 2;
      }
      return {
        gi: gi,
        g: g,
        p: p,
        label: label,
        align: align,
        leftEdge: leftEdge,
        rightEdge: rightEdge,
      };
    });
    // Rarire "de la coada spre inceput": ultima luna (cea mai recenta) e
    // mereu pastrata necondiționat, apoi se parcurge in ordine inversa,
    // pastrand o eticheta mai veche doar daca amprenta ei nu se suprapune cu
    // cea mai apropiata eticheta deja pastrata (mai recenta) - garanteaza
    // matematic zero suprapuneri (spre deosebire de o trecere simpla
    // stanga-dreapta cu "fortare" a ultimei etichete la final, care putea
    // lasa totusi o suprapunere cand doar 2-3 luni incap intr-un interval
    // scurt si ultimele doua ancore sunt foarte apropiate).
    var keptTicksRev = [candidates[candidates.length - 1]];
    for (var ci2 = candidates.length - 2; ci2 >= 0; ci2--) {
      var cnd2 = candidates[ci2];
      var nextKept = keptTicksRev[keptTicksRev.length - 1];
      if (cnd2.rightEdge + gapPct <= nextKept.leftEdge) {
        keptTicksRev.push(cnd2);
      }
    }
    var keptTicks = keptTicksRev.reverse();

    // --- gridline-uri verticale punctate, discrete, la fiecare ancora de
    // luna pastrata dupa rarire (aceleasi ancore ca etichetele axei X, ca sa
    // nu aglomereze graficul cu mai multe linii decat etichete).
    var gridlinesSvg = keptTicks
      .map(function (cnd) {
        return (
          '<line x1="' +
          cnd.p.x.toFixed(1) +
          '" y1="' +
          PAD +
          '" x2="' +
          cnd.p.x.toFixed(1) +
          '" y2="' +
          (H - PAD) +
          '" class="mp-chart-month-gridline" stroke="rgba(255,255,255,.14)" stroke-width="1" stroke-dasharray="3 4"></line>'
        );
      })
      .join("");

    var pointsStr = pts
      .map(function (p) {
        return p.x.toFixed(1) + "," + p.y.toFixed(1);
      })
      .join(" ");
    var trendUp = values[values.length - 1] >= values[0];
    var strokeColor = trendUp ? "#18d98b" : "#ff4056";
    var areaPoints =
      pointsStr +
      " " +
      xFor(filtered.length - 1).toFixed(1) +
      "," +
      (H - PAD) +
      " " +
      PAD +
      "," +
      (H - PAD);

    var lastPt = pts[pts.length - 1];

    // --- linia capitalului initial (cerinta 3): linie orizontala punctata,
    // discreta, aurie, cu zona de deasupra tintata verde (profit) si zona de
    // dedesubt tintata rosu (pierdere). Implementata prin doua copii ale
    // ariei sub curba, fiecare decupata (clip-path) la jumatatea de
    // deasupra/dedesubt liniei - nu un singur fill de "trend" pentru toata
    // aria, ca sa reflecte corect zonele de profit/pierdere fata de capital,
    // nu doar directia generala a curbei.
    var capitalSvg,
      capitalLabelHtml = "";
    if (capitalValue != null) {
      var yCap = yFor(capitalValue);
      if (yCap < PAD) yCap = PAD;
      if (yCap > H - PAD) yCap = H - PAD;
      var clipSuffix = (meta.code || "x") + "-" + Math.round(capitalValue * 100);
      var clipTopId = "mpClipTop-" + clipSuffix;
      var clipBotId = "mpClipBot-" + clipSuffix;
      capitalSvg =
        "<defs>" +
        '<clipPath id="' +
        clipTopId +
        '"><rect x="0" y="0" width="' +
        W +
        '" height="' +
        yCap.toFixed(1) +
        '"></rect></clipPath>' +
        '<clipPath id="' +
        clipBotId +
        '"><rect x="0" y="' +
        yCap.toFixed(1) +
        '" width="' +
        W +
        '" height="' +
        (H - yCap).toFixed(1) +
        '"></rect></clipPath>' +
        "</defs>" +
        '<polygon points="' +
        areaPoints +
        '" fill="#18d98b" fill-opacity="0.14" clip-path="url(#' +
        clipTopId +
        ')"></polygon>' +
        '<polygon points="' +
        areaPoints +
        '" fill="#ff4056" fill-opacity="0.14" clip-path="url(#' +
        clipBotId +
        ')"></polygon>' +
        '<line x1="' +
        PAD +
        '" y1="' +
        yCap.toFixed(1) +
        '" x2="' +
        (W - PAD) +
        '" y2="' +
        yCap.toFixed(1) +
        '" stroke="#e8b923" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.8"></line>';
      var capTopPct = (yCap / H) * 100;
      var capBelow = capTopPct < 12;
      capitalLabelHtml =
        '<div class="mp-chart-capital-label' +
        (capBelow ? " is-below" : "") +
        '" style="top:' +
        capTopPct.toFixed(2) +
        '%">' +
        esc(tfmt("chartInitialCapitalLine", { amount: fmtMoneyAxis(capitalValue, currency) })) +
        "</div>";
    } else {
      // Fallback (nu ar trebui sa apara in practica - toate portofoliile au
      // initialCapital): un singur fill de culoare de trend, ca graficul sa
      // nu ramana fara nicio arie doar pentru ca lipseste capitalul de
      // referinta.
      capitalSvg =
        '<polygon points="' +
        areaPoints +
        '" fill="' +
        strokeColor +
        '" fill-opacity="0.12" stroke="none"></polygon>';
    }

    // --- linia/punctele colorate pe segment fata de capital (cerinta 7,
    // redesign 2026-08-05): daca stim capitalValue, linia nu mai e desenata
    // ca o singura polilinie de o culoare ("trend general"), ci ca segmente
    // individuale, colorate exact fata de pozitia lor relativa la linia
    // capitalului, cu intersectia interpolata precis (vezi
    // buildColoredSegments). Fallback (fara capitalValue): o singura
    // polilinie in culoarea trendului general, ca inainte.
    var lineSvg;
    if (capitalValue != null) {
      lineSvg = buildColoredSegments(pts, capitalValue)
        .map(function (s) {
          return (
            '<line x1="' +
            s.x1.toFixed(1) +
            '" y1="' +
            s.y1.toFixed(1) +
            '" x2="' +
            s.x2.toFixed(1) +
            '" y2="' +
            s.y2.toFixed(1) +
            '" stroke="' +
            s.color +
            '" stroke-width="2.4" stroke-linecap="round"></line>'
          );
        })
        .join("");
    } else {
      lineSvg =
        '<polyline points="' +
        pointsStr +
        '" fill="none" stroke="' +
        strokeColor +
        '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>';
    }

    // --- hit-targets: un cerc invizibil (raza mare, usor de atins pe mobil)
    // per punct, plus un marcaj mic vizibil pe FIECARE punct, colorat fata
    // de capital (cerinta 7: "punctele isi schimba si ele culoarea"), si un
    // halou discret, pulsatoriu, DOAR pe ultimul punct (cerinta 7: evidentiere
    // cu cerc luminos discret). <title> nativ pe fiecare, ca fallback minimal
    // accesibil (tastatura/cititor de ecran) in plus fata de tooltip-ul HTML
    // custom. TOATE instantaneele raman puncte distincte aici, indiferent
    // cate grupuri de luni sunt etichetate pe axa X (vezi computeMonthGroups).
    var circlesSvg = pts
      .map(function (p) {
        var isLast = p.i === pts.length - 1;
        var pointColor = capitalValue != null ? sideColor(p.h.navValue, capitalValue) : strokeColor;
        var titleText =
          fmtDateLong(p.h.asOfDate) +
          " — " +
          t("chartTotalValue") +
          ": " +
          fmtMoneyLocale(p.h.navValue, currency);
        var visibleMarker;
        if (isLast) {
          visibleMarker =
            '<circle cx="' +
            p.x.toFixed(1) +
            '" cy="' +
            p.y.toFixed(1) +
            '" r="11" fill="' +
            pointColor +
            '" fill-opacity="0.28" class="mp-chart-point-last-halo"></circle>' +
            '<circle cx="' +
            p.x.toFixed(1) +
            '" cy="' +
            p.y.toFixed(1) +
            '" r="5" fill="' +
            pointColor +
            '" stroke="#04101f" stroke-width="2" class="mp-chart-point-last"></circle>';
        } else {
          visibleMarker =
            '<circle cx="' +
            p.x.toFixed(1) +
            '" cy="' +
            p.y.toFixed(1) +
            '" r="2.6" fill="' +
            pointColor +
            '" stroke="#04101f" stroke-width="1" class="mp-chart-point-mini"></circle>';
        }
        return (
          visibleMarker +
          '<circle cx="' +
          p.x.toFixed(1) +
          '" cy="' +
          p.y.toFixed(1) +
          '" r="14" fill="transparent" class="mp-chart-hit" data-idx="' +
          p.i +
          '"><title>' +
          esc(titleText) +
          "</title></circle>"
        );
      })
      .join("");

    var svg =
      '<svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" preserveAspectRatio="none" role="img" aria-label="' +
      esc(meta.code ? tfmt("chartTitleTemplate", { code: meta.code }) : t("evolution")) +
      '">' +
      gridlinesSvg +
      capitalSvg +
      lineSvg +
      circlesSvg +
      "</svg>";

    // --- axa verticala (NAV total al portofoliului, in moneda de baza):
    // repere rotunde ("nice numbers", vezi computeNiceTicks mai sus), NU
    // neaparat de la zero - plaja (min/max) e deja rotunjita mai sus.
    var yTicksHtml = nice.ticks
      .slice()
      .sort(function (a, b) {
        return b - a;
      })
      .map(function (v) {
        var topPct = (yFor(v) / H) * 100;
        return (
          '<span class="mp-chart-ytick" style="top:' +
          topPct.toFixed(2) +
          '%">' +
          esc(fmtMoneyAxis(v, currency)) +
          "</span>"
        );
      })
      .join("");

    // --- axa orizontala (cerinta axei X): o singura eticheta pe linie per
    // luna de la fondare ("Luna N — luna calendaristica", ex.
    // "Luna 1 — Mai 2026"), niciodata aceeasi luna calendaristica de doua
    // ori - vezi computeMonthGroups. Grupurile, latimile masurate si rarirea
    // lor (keptTicks) au fost deja calculate mai sus (si refolosite pentru
    // gridline-urile verticale).
    var xTicksHtml = keptTicks
      .map(function (cnd) {
        return (
          '<span class="mp-chart-xtick mp-chart-xtick-' +
          cnd.align +
          '" style="left:' +
          cnd.p.xPct.toFixed(2) +
          '%">' +
          '<span class="mp-chart-xtick-label">' +
          esc(cnd.label) +
          "</span>" +
          "</span>"
        );
      })
      .join("");

    // --- eticheta permanenta a ultimului punct (cerinta 5, ordine exacta:
    // NAV, randament, data) - NU foloseste cuvantul "live", e strict ultimul
    // instantaneu inregistrat.
    var lastMetrics = computePointMetrics(lastPt.h);
    var lastReturnText = pointReturnText(lastPt.h, lastMetrics);
    // Daca ultimul punct e in treimea de sus a graficului, eticheta se
    // afiseaza SUB punct in loc de deasupra, ca sa nu iasa din cardul cu
    // overflow:hidden (vezi .mp-card in member-portfolios.css).
    var lastBadgeBelow = lastPt.yPct < 30;
    var lastBadgeCls = "mp-chart-last-badge" + (lastBadgeBelow ? " is-below" : "");
    var lastBadgeHtml =
      '<div class="' +
      lastBadgeCls +
      '" style="left:' +
      lastPt.xPct.toFixed(2) +
      "%;top:" +
      lastPt.yPct.toFixed(2) +
      '%">' +
      '<div class="mp-chart-last-nav">' +
      esc(fmtMoneyLocale(lastPt.h.navValue, currency)) +
      "</div>" +
      '<div class="mp-chart-last-pct ' +
      signClass(lastMetrics.returnPct) +
      '" data-return-state="' +
      (lastPt.h.returnIsPending ? "pending" : "ready") +
      '">' +
      esc(lastReturnText) +
      "</div>" +
      '<div class="mp-chart-last-date">' +
      esc(fmtDateLong(lastPt.h.asOfDate)) +
      "</div>" +
      "</div>";

    wrap.innerHTML =
      '<div class="mp-chart-grid">' +
      '<div class="mp-chart-yaxis">' +
      yTicksHtml +
      "</div>" +
      '<div class="mp-chart-plot">' +
      svg +
      capitalLabelHtml +
      '<div class="mp-chart-tooltip" id="mpChartTooltip" hidden></div>' +
      lastBadgeHtml +
      "</div>" +
      "</div>" +
      '<div class="mp-chart-xaxis">' +
      xTicksHtml +
      "</div>";

    wireChartInteraction(wrap, pts, currency, founded);
  }

  // Cablaj hover (desktop) / tap (mobil) pentru tooltip-ul per-punct -
  // cerinta 4 (tooltip pe 6 randuri). Foloseste Pointer Events (unifica
  // mouse + touch + stylus): pointermove urmareste cel mai apropiat punct
  // de-a lungul axei X in timp ce cursorul/degetul se misca deasupra
  // graficului; pointerdown afiseaza imediat tooltip-ul la atingere (nu
  // doar dupa o miscare); pointerleave (doar desktop, mouse-ul chiar
  // paraseste zona) ascunde tooltip-ul; pe mobil, o atingere in afara
  // graficului il ascunde (listener global).
  function wireChartInteraction(wrap, pts, currency, founded) {
    var plot = wrap.querySelector(".mp-chart-plot");
    var tooltip = wrap.querySelector("#mpChartTooltip");
    if (!plot || !tooltip) return;

    function nearestIndexFromClientX(clientX) {
      var rect = plot.getBoundingClientRect();
      if (!rect.width) return 0;
      var frac = (clientX - rect.left) / rect.width;
      if (frac < 0) frac = 0;
      if (frac > 1) frac = 1;
      return Math.round(frac * (pts.length - 1));
    }

    function showTooltipForIndex(idx) {
      var p = pts[idx];
      if (!p) return;
      var m = computePointMetrics(p.h);
      var monthLine = founded
        ? '<div class="mp-chart-tooltip-month">' +
          esc(tfmt("chartMonthSinceFounding", { n: monthsSinceFounding(founded, p.h.asOfDate) })) +
          "</div>"
        : "";
      // Fiecare rand eticheta/valoare foloseste doi copii flex distincti
      // (span + b), nu text simplu urmat de ": " - vezi ".mp-chart-tooltip-
      // row{display:flex;justify-content:space-between}" din
      // member-portfolios.css (redesign 2026-08-05), ca eticheta si valoarea
      // sa ramana aliniate pe acelasi rand indiferent de lungimea textului
      // tradus (RO/EN/RU/UK/PL).
      function row(cls, label, value) {
        return (
          '<div class="mp-chart-tooltip-row' +
          (cls ? " " + cls : "") +
          '"><span>' +
          esc(label) +
          "</span><b>" +
          esc(value) +
          "</b></div>"
        );
      }
      tooltip.innerHTML =
        '<div class="mp-chart-tooltip-date">' +
        esc(fmtDateLong(p.h.asOfDate)) +
        "</div>" +
        monthLine +
        row(null, t("chartTotalValue"), fmtMoneyLocale(p.h.navValue, currency)) +
        row(null, t("chartCapitalInvested"), fmtMoneyLocale(p.h.capitalContributed, currency)) +
        row(signClass(m.profitLoss), t("chartProfit"), fmtSignedMoney(m.profitLoss, currency)) +
        row(
          signClass(m.returnPct) + (p.h.returnIsPending ? " is-pending" : ""),
          t("totalReturn"),
          pointReturnText(p.h, m),
        );
      tooltip.hidden = false;

      var plotRect = plot.getBoundingClientRect();
      var leftPx = (p.xPct / 100) * plotRect.width;
      var topPx = (p.yPct / 100) * plotRect.height;

      // Clamp orizontal: langa marginile stanga/dreapta, tooltip-ul se
      // aliniaza la punct in loc sa fie centrat pe el, ca sa nu iasa din
      // #mpChartWrap (care are overflow:hidden mostenit de la .mp-card).
      var tw = tooltip.offsetWidth || 170;
      var translateX = "-50%";
      if (leftPx < tw / 2 + 6) translateX = "0%";
      else if (leftPx > plotRect.width - tw / 2 - 6) translateX = "-100%";

      // Clamp vertical: daca punctul e prea aproape de partea de sus,
      // tooltip-ul apare SUB punct in loc de deasupra.
      var th = tooltip.offsetHeight || 130;
      var translateY = topPx - th - 14 < 0 ? "16px" : "calc(-100% - 14px)";

      tooltip.style.left = leftPx + "px";
      tooltip.style.top = topPx + "px";
      tooltip.style.transform = "translate(" + translateX + ", " + translateY + ")";
    }

    function hideTooltip() {
      tooltip.hidden = true;
    }

    plot.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse" || e.pointerType === "") {
        showTooltipForIndex(nearestIndexFromClientX(e.clientX));
      }
    });
    plot.addEventListener("pointerdown", function (e) {
      showTooltipForIndex(nearestIndexFromClientX(e.clientX));
    });
    plot.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" || e.pointerType === "") hideTooltip();
    });
    // Pe mobil (touch), o atingere in afara graficului ascunde tooltip-ul
    // deschis de un tap anterior.
    document.addEventListener("pointerdown", function (e) {
      if (!tooltip.hidden && !wrap.contains(e.target)) hideTooltip();
    });
  }

  function renderPositions(positions, baseCurrency) {
    var body = document.getElementById("mpPositionsBody");
    if (!body) return;
    if (!positions || !positions.length) {
      body.innerHTML = '<tr><td colspan="6">' + esc(t("noData")) + "</td></tr>";
      return;
    }
    body.innerHTML = positions
      .map(function (pos) {
        // Pondere initiala (initialWeightPct): suma tranzactiilor BUY ale
        // pozitiei / capitalul initial al portofoliului - fixa, istorica,
        // NU depinde de pretul curent. null (nu 0) cand lipseste tranzactia
        // BUY sau cursul de conversie necesar - "curs indisponibil" explicit.
        var weightText = fmtWeight(pos.initialWeightPct);
        var weightHtml = weightText
          ? esc(weightText)
          : '<span class="mp-weight-na">' + esc(t("rateUnavailable")) + "</span>";

        // Pret curent / profit: pana la integrarea unui furnizor de preturi
        // live (priceSource === 'live_feed'), NU se afiseaza nicio cifra -
        // nici macar pretul de referinta - ci explicit "In asteptarea
        // datelor live". Vezi cerinta: nu prezenta pretul de referinta ca
        // pret live.
        var isLive = pos.priceSource === "delayed_feed" || pos.priceSource === "live_feed";
        var currentPriceHtml =
          isLive && pos.currentPrice != null
            ? esc(fmtMoney(pos.currentPrice, pos.instrumentCurrency))
            : '<span class="mp-awaiting-live">' + esc(t("awaitingLiveData")) + "</span>";

        var plClass =
          pos.plInstrumentCcy > 0
            ? "mp-pl-pos"
            : pos.plInstrumentCcy < 0
              ? "mp-pl-neg"
              : "mp-pl-flat";
        var plHtml =
          isLive && pos.plInstrumentCcy != null
            ? esc(
                fmtMoney(pos.plInstrumentCcy, pos.instrumentCurrency) +
                  " (" +
                  fmtPct(pos.plPct) +
                  ")",
              )
            : '<span class="mp-awaiting-live">' + esc(t("awaitingLiveData")) + "</span>";
        if (!isLive) plClass = "mp-cell-muted";

        var riskClass = pos.riskLevel === "high" ? "high" : pos.riskLevel === "low" ? "low" : "med";

        return (
          '<tr><td class="ticker">' +
          esc(pos.ticker) +
          "</td>" +
          "<td>" +
          weightHtml +
          "</td>" +
          "<td>" +
          esc(fmtMoney(pos.avgPrice, pos.instrumentCurrency)) +
          "</td>" +
          "<td>" +
          currentPriceHtml +
          "</td>" +
          '<td class="' +
          plClass +
          '">' +
          plHtml +
          "</td>" +
          '<td><span class="risk-badge ' +
          riskClass +
          '">' +
          esc(pos.riskLevel || "—") +
          "</span></td></tr>"
        );
      })
      .join("");
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
    body.innerHTML = reserves
      .map(function (r) {
        var statusLabel = r.status === "released" ? t("statusReleased") : t("statusReserved");
        var label =
          cashCategoryLabel(r.category) +
          (r.reservedForTicker ? " (" + r.reservedForTicker + ")" : "");
        return (
          "<tr><td>" +
          esc(label) +
          "</td>" +
          "<td>" +
          esc(fmtMoney(r.amount, r.currency)) +
          "</td>" +
          "<td>" +
          esc(statusLabel) +
          "</td></tr>"
        );
      })
      .join("");
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
    body.innerHTML = dividends
      .map(function (d) {
        return (
          '<tr><td class="ticker">' +
          esc(d.ticker) +
          "</td>" +
          "<td>" +
          esc(fmtMoney(d.amount, d.currency)) +
          "</td>" +
          "<td>" +
          esc(fmtDate(d.payDate)) +
          "</td></tr>"
        );
      })
      .join("");
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
    body.innerHTML = transactions
      .map(function (tx) {
        return (
          "<tr><td>" +
          esc(tx.type) +
          "</td>" +
          '<td class="ticker">' +
          esc(tx.ticker || "—") +
          "</td>" +
          "<td>" +
          esc(fmtMoney(tx.amount, tx.currency)) +
          "</td>" +
          "<td>" +
          esc(fmtDate(tx.executedAt)) +
          "</td></tr>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Init */
  /* ------------------------------------------------------------------ */
  function init() {
    STATE.lang = getLang();
    wireHeader();
    updateLangSwitcherUI();
    applyStaticTexts();
    loadPortfolios();
    // Etapa 4, cerinta 15: pagina porneste mereu vizibila la incarcare, deci
    // pornim polling-ul direct - handler-ul visibilitychange de mai sus
    // preia controlul (stopPolling/startPolling) dupa aceea.
    startPolling();
  }

  // Hook inert in productie, folosit doar de testele locale de render cu un
  // DOM minimal injectat. Expune exact functiile folosite de UI, nu copii.
  if (typeof globalThis !== "undefined" && globalThis.__TSB_TEST_HOOKS__) {
    globalThis.__TSB_TEST_HOOKS__.memberPortfolios = {
      computePointMetrics: computePointMetrics,
      pointReturnText: pointReturnText,
      drawChart: drawChart,
      wireChartInteraction: wireChartInteraction,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
