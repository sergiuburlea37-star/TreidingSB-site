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
// Punctele (filtrate dupa interval) ale graficului curent afisat -
// pastrate aici doar ca sa poata fi redesenate la resize (vezi
// renderChart/drawChart mai jos), fara sa mai treaca din nou prin
// filterHistoryByInterval.
chartPoints: null,
// Metadatele graficului curent (moneda, capitalul initial, data de
// fondare) - salvate odata cu chartPoints ca sa poata fi refolosite la
// redesenarea din resize (vezi wireDashboardControlsOnce), fara sa
// recalculam din STATE.portfolios.
chartMeta: null
};

/* ------------------------------------------------------------------ */
/* i18n */
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
chartValueLabel: "Valoare portofoliu",
chartTotalValue: "Valoare totală", chartCapitalInvested: "Capital investit",
chartProfit: "Profit", chartMonthShort: "Luna {n}",
chartMonthSinceFounding: "Luna {n} de la fondare",
chartInitialCapitalLine: "Capital inițial: {amount}",
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
chartValueLabel: "Portfolio value",
chartTotalValue: "Total value", chartCapitalInvested: "Capital invested",
chartProfit: "Profit", chartMonthShort: "Month {n}",
chartMonthSinceFounding: "Month {n} since founding",
chartInitialCapitalLine: "Initial capital: {amount}",
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
chartValueLabel: "Стоимость портфеля",
chartTotalValue: "Общая стоимость", chartCapitalInvested: "Вложенный капитал",
chartProfit: "Прибыль", chartMonthShort: "Месяц {n}",
chartMonthSinceFounding: "Месяц {n} с основания",
chartInitialCapitalLine: "Начальный капитал: {amount}",
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
chartValueLabel: "Вартість портфеля",
chartTotalValue: "Загальна вартість", chartCapitalInvested: "Вкладений капітал",
chartProfit: "Прибуток", chartMonthShort: "Місяць {n}",
chartMonthSinceFounding: "Місяць {n} від заснування",
chartInitialCapitalLine: "Початковий капітал: {amount}",
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
chartValueLabel: "Wartość portfela",
chartTotalValue: "Wartość całkowita", chartCapitalInvested: "Zainwestowany kapitał",
chartProfit: "Zysk", chartMonthShort: "Miesiąc {n}",
chartMonthSinceFounding: "Miesiąc {n} od założenia",
chartInitialCapitalLine: "Kapitał początkowy: {amount}",
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
if (langSwitcher) { langSwitcher.classList.remove("is-open"); if (langBtn) langBtn.setAttribute("aria-expanded", "false"); }
if (accountDropdown) { accountDropdown.classList.remove("is-open"); if (memberBtn) memberBtn.setAttribute("aria-expanded", "false"); }
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
return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
} catch (e) { return iso; }
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
var s = new Date(iso + "T00:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" });
return s.charAt(0).toUpperCase() + s.slice(1);
} catch (e) { return iso; }
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
return new Date(iso).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
} catch (e) { return iso; }
}

// Suma formatata cu separatorul de mii/zecimale al limbii curente (nu
// locale-ul implicit al browserului, ca fmtMoney - vezi nota din
// renderChart despre de ce graficul foloseste un formator dedicat).
function fmtMoneyLocale(amount, currency) {
if (amount === null || amount === undefined || isNaN(amount)) return "—";
var locale = LOCALE_MAP[STATE.lang] || "ro-RO";
var symbol = CCY_SYMBOLS[currency] || (currency ? currency + " " : "");
return symbol + Math.abs(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
var abs = Math.abs(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
var abs = Math.abs(pct).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
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
return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* State switching */
/* ------------------------------------------------------------------ */
function showState(name) {
["mpStateLoading", "mpStateLocked", "mpStateError", "mpStateDashboard"].forEach(function (id) {
var el = document.getElementById(id);
if (el) el.hidden = (id !== name);
});
}

/* ------------------------------------------------------------------ */
/* Auth + data loading */
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
renderChart(p);
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
return count <= 1 ? [0, n - 1].filter(function (v, idx, arr) { return arr.indexOf(v) === idx; }) : all;
}
var idx = [];
for (var k = 0; k < count; k++) {
idx.push(Math.round((k * (n - 1)) / (count - 1)));
}
return idx.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
}

// Calculeaza profitul/pierderea si randamentul cumulativ pentru un
// instantaneu, EXACT dupa formulele cerute:
// profit_pierdere = nav_value - capital_contributed
// randament_pct = ((nav_value / capital_contributed) - 1) * 100
// Daca tabela are deja cumulative_return_pct (h.cumulativeReturnPct),
// valoarea din baza de date e folosita pentru AFISARE doar daca e
// consistenta cu formula (diferenta sub CONSISTENCY_EPSILON puncte
// procentuale) - altfel se foloseste valoarea calculata aici, niciodata
// o valoare din baza de date nereconciliata cu formula ceruta.
var RETURN_CONSISTENCY_EPSILON = 0.05;
function computePointMetrics(h) {
var nav = h.navValue;
var capital = h.capitalContributed;
var profitLoss = (nav != null && capital != null) ? (nav - capital) : null;
var computedPct = (nav != null && capital) ? ((nav / capital) - 1) * 100 : null;
var dbPct = (h.cumulativeReturnPct === null || h.cumulativeReturnPct === undefined) ? null : Number(h.cumulativeReturnPct);
var returnPct = computedPct;
if (computedPct != null && dbPct != null && Math.abs(dbPct - computedPct) < RETURN_CONSISTENCY_EPSILON) {
returnPct = dbPct;
}
return { profitLoss: profitLoss, returnPct: returnPct };
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
function renderChart(p) {
var wrap = document.getElementById("mpChartWrap");
var emptyEl = document.getElementById("mpChartEmpty");
if (!wrap) return;

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
var capital = (p.initialCapital != null) ? p.initialCapital
: (filtered[0] ? filtered[0].capitalContributed : null);
var meta = {
code: p.code,
currency: p.baseCurrency || (filtered[0] ? filtered[0].currency : null),
capital: capital,
founded: FOUNDING_DATES[p.code] || null
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
return filtered.map(function (h, i) { return { monthIndex: i + 1, idx: i, iso: h.asOfDate }; });
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
function drawChart(wrap, filtered, meta) {
var W = 1000, H = 280, PAD = 10;
var currency = meta.currency;
var capitalValue = meta.capital;
var founded = meta.founded;

var values = filtered.map(function (h) { return h.navValue; });
var rawMin = Math.min.apply(null, values), rawMax = Math.max.apply(null, values);
// Domeniul axei Y include si valoarea capitalului initial (ca linia lui
// orizontala sa fie mereu vizibila in grafic, nu doar cand NAV-ul e deja
// aproape de ea) si NU incepe neaparat de la zero (cerinta axei Y:
// variatiile trebuie sa ramana vizibile) - plus un padding "rezonabil"
// (8% din plaja) sus si jos, ca linia si punctele sa nu fie lipite de
// marginile graficului.
var domainMin = (capitalValue != null) ? Math.min(rawMin, capitalValue) : rawMin;
var domainMax = (capitalValue != null) ? Math.max(rawMax, capitalValue) : rawMax;
if (domainMin === domainMax) { domainMin -= 100; domainMax += 100; }
var span = domainMax - domainMin;
var padY = span * 0.08;
var min = domainMin - padY, max = domainMax + padY;

var innerH = H - PAD * 2;
var stepX = (W - PAD * 2) / (filtered.length - 1);

function xFor(i) { return PAD + i * stepX; }
function yFor(v) { return H - PAD - ((v - min) / (max - min)) * innerH; }

var pts = filtered.map(function (h, i) {
var x = xFor(i), y = yFor(h.navValue);
return { i: i, x: x, y: y, xPct: (x / W) * 100, yPct: (y / H) * 100, h: h };
});

var pointsStr = pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
var trendUp = values[values.length - 1] >= values[0];
var strokeColor = trendUp ? "#18d98b" : "#ff4056";
var areaPoints = pointsStr + " " + xFor(filtered.length - 1).toFixed(1) + "," + (H - PAD) + " " + PAD + "," + (H - PAD);

var lastPt = pts[pts.length - 1];

// --- linia capitalului initial (cerinta 3): linie orizontala punctata,
// discreta, aurie, cu zona de deasupra tintata verde (profit) si zona de
// dedesubt tintata rosu (pierdere). Implementata prin doua copii ale
// ariei sub curba, fiecare decupata (clip-path) la jumatatea de
// deasupra/dedesubt liniei - nu un singur fill de "trend" pentru toata
// aria, ca sa reflecte corect zonele de profit/pierdere fata de capital,
// nu doar directia generala a curbei.
var capitalSvg, capitalLabelHtml = "";
if (capitalValue != null) {
var yCap = yFor(capitalValue);
if (yCap < PAD) yCap = PAD;
if (yCap > H - PAD) yCap = H - PAD;
var clipSuffix = (meta.code || "x") + "-" + Math.round(capitalValue * 100);
var clipTopId = "mpClipTop-" + clipSuffix;
var clipBotId = "mpClipBot-" + clipSuffix;
capitalSvg =
"<defs>" +
"<clipPath id=\"" + clipTopId + "\"><rect x=\"0\" y=\"0\" width=\"" + W + "\" height=\"" + yCap.toFixed(1) + "\"></rect></clipPath>" +
"<clipPath id=\"" + clipBotId + "\"><rect x=\"0\" y=\"" + yCap.toFixed(1) + "\" width=\"" + W + "\" height=\"" + (H - yCap).toFixed(1) + "\"></rect></clipPath>" +
"</defs>" +
"<polygon points=\"" + areaPoints + "\" fill=\"#18d98b\" fill-opacity=\"0.14\" clip-path=\"url(#" + clipTopId + ")\"></polygon>" +
"<polygon points=\"" + areaPoints + "\" fill=\"#ff4056\" fill-opacity=\"0.14\" clip-path=\"url(#" + clipBotId + ")\"></polygon>" +
"<line x1=\"" + PAD + "\" y1=\"" + yCap.toFixed(1) + "\" x2=\"" + (W - PAD) + "\" y2=\"" + yCap.toFixed(1) +
"\" stroke=\"#e8b923\" stroke-width=\"1.4\" stroke-dasharray=\"5 4\" opacity=\"0.8\"></line>";
var capTopPct = (yCap / H) * 100;
var capBelow = capTopPct < 12;
capitalLabelHtml = "<div class=\"mp-chart-capital-label" + (capBelow ? " is-below" : "") + "\" style=\"top:" + capTopPct.toFixed(2) + "%\">" +
esc(tfmt("chartInitialCapitalLine", { amount: fmtMoneyAxis(capitalValue, currency) })) + "</div>";
} else {
// Fallback (nu ar trebui sa apara in practica - toate portofoliile au
// initialCapital): un singur fill de culoare de trend, ca graficul sa
// nu ramana fara nicio arie doar pentru ca lipseste capitalul de
// referinta.
capitalSvg = "<polygon points=\"" + areaPoints + "\" fill=\"" + strokeColor + "\" fill-opacity=\"0.12\" stroke=\"none\"></polygon>";
}

// --- hit-targets: un cerc invizibil (raza mare, usor de atins pe mobil)
// per punct, plus un cerc mic vizibil doar pe ultimul punct (evidentiere
// - cerinta 5). <title> nativ pe fiecare, ca fallback minimal accesibil
// (tastatura/cititor de ecran) in plus fata de tooltip-ul HTML custom.
// TOATE instantaneele raman puncte distincte aici, indiferent cate
// grupuri de luni sunt etichetate pe axa X (vezi computeMonthGroups).
var circlesSvg = pts.map(function (p) {
var isLast = p.i === pts.length - 1;
var titleText = fmtDateLong(p.h.asOfDate) + " — " + t("chartTotalValue") + ": " + fmtMoneyLocale(p.h.navValue, currency);
var visibleMarker = isLast
? "<circle cx=\"" + p.x.toFixed(1) + "\" cy=\"" + p.y.toFixed(1) + "\" r=\"5\" fill=\"" + strokeColor + "\" stroke=\"#04101f\" stroke-width=\"2\" class=\"mp-chart-point-last\"></circle>"
: "";
return visibleMarker +
"<circle cx=\"" + p.x.toFixed(1) + "\" cy=\"" + p.y.toFixed(1) + "\" r=\"14\" fill=\"transparent\" class=\"mp-chart-hit\" data-idx=\"" + p.i + "\"><title>" + esc(titleText) + "</title></circle>";
}).join("");

var svg = "<svg viewBox=\"0 0 " + W + " " + H + "\" preserveAspectRatio=\"none\" role=\"img\" aria-label=\"" +
esc(t("evolution")) + "\">" +
capitalSvg +
"<polyline points=\"" + pointsStr + "\" fill=\"none\" stroke=\"" + strokeColor + "\" stroke-width=\"2.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></polyline>" +
circlesSvg +
"</svg>";

// --- axa verticala (NAV total al portofoliului, in moneda de baza): 4
// repere egal distantate intre min si max (plaja acum dinamica, cu
// padding - vezi mai sus -, NU neaparat de la zero).
var yTickCount = 4;
var yTicksHtml = "";
for (var ti = 0; ti < yTickCount; ti++) {
var v = max - (ti * (max - min)) / (yTickCount - 1);
var topPct = (yFor(v) / H) * 100;
yTicksHtml += "<span class=\"mp-chart-ytick\" style=\"top:" + topPct.toFixed(2) + "%\">" + esc(fmtMoneyAxis(v, currency)) + "</span>";
}

// --- axa orizontala (cerinta axei X): o eticheta pe 2 linii per luna de
// la fondare ("Luna N" + luna calendaristica, ex. "Mai 2026"), niciodata
// aceeasi luna calendaristica de doua ori - vezi computeMonthGroups.
//
// Rarirea grupurilor NU se face dupa un numar fix de etichete (un simplu
// "maxLabels" pe baza latimii), ci printr-un filtru "greedy" bazat pe
// distanta reala in pixeli dintre ancorele consecutive: o eticheta noua e
// pastrata doar daca e la cel putin `minLabelPx` de precedenta pastrata -
// altfel s-ar putea suprapune vizual (ex. cand doar 2 luni exista in
// intervalul activ, dar al doilea instantaneu al lunii urmatoare e la
// putin timp dupa primul - vezi si "1L" cu doar 5 instantanee). Ultima
// luna (cea mai recenta) e mereu pastrata, chiar daca inlocuieste
// eticheta anterioara pastrata, ca sa ramana mereu vizibila data cea mai
// recenta pe axa.
var groups = computeMonthGroups(founded, filtered);
var wrapWidth = wrap.clientWidth || 760;
var minLabelPx = wrapWidth <= 420 ? 60 : (wrapWidth <= 640 ? 74 : 90);
var minGapPct = (minLabelPx / wrapWidth) * 100;
var groupIdxs = [];
if (groups.length) {
groupIdxs.push(0);
var lastKeptX = pts[groups[0].idx].xPct;
for (var gi2 = 1; gi2 < groups.length; gi2++) {
var curX = pts[groups[gi2].idx].xPct;
var isLastGroup = gi2 === groups.length - 1;
if (curX - lastKeptX >= minGapPct) {
groupIdxs.push(gi2);
lastKeptX = curX;
} else if (isLastGroup) {
if (groupIdxs.length > 1) groupIdxs[groupIdxs.length - 1] = gi2;
else groupIdxs.push(gi2);
lastKeptX = curX;
}
}
}
// Alinierea etichetei (stanga/centru/dreapta fata de ancora ei) se
// decide dupa POZITIA REALA in grafic, nu dupa faptul ca e prima/ultima
// luna pastrata - altfel o "ultima luna" care se intampla sa fie totusi
// aproape de marginea stanga (interval scurt, putine luni) ar creste
// spre stanga peste eticheta anterioara (exact suprapunerea descrisa mai
// sus). Doar ancorele chiar aproape de marginea stanga/dreapta a
// containerului cresc spre interior; restul sunt centrate pe ancora lor.
var xTicksHtml = groupIdxs.map(function (gi) {
var g = groups[gi];
var p = pts[g.idx];
var align = p.xPct < 15 ? "left" : (p.xPct > 85 ? "right" : "center");
return "<span class=\"mp-chart-xtick mp-chart-xtick-" + align + "\" style=\"left:" + p.xPct.toFixed(2) + "%\">" +
"<span class=\"mp-chart-xtick-month\">" + esc(tfmt("chartMonthShort", { n: g.monthIndex })) + "</span>" +
"<span class=\"mp-chart-xtick-cal\">" + esc(fmtMonthYear(g.iso)) + "</span>" +
"</span>";
}).join("");

// --- eticheta permanenta a ultimului punct (cerinta 5, ordine exacta:
// NAV, randament, data) - NU foloseste cuvantul "live", e strict ultimul
// instantaneu inregistrat.
var lastMetrics = computePointMetrics(lastPt.h);
// Daca ultimul punct e in treimea de sus a graficului, eticheta se
// afiseaza SUB punct in loc de deasupra, ca sa nu iasa din cardul cu
// overflow:hidden (vezi .mp-card in member-portfolios.css).
var lastBadgeBelow = lastPt.yPct < 30;
var lastBadgeCls = "mp-chart-last-badge" + (lastBadgeBelow ? " is-below" : "");
var lastBadgeHtml =
"<div class=\"" + lastBadgeCls + "\" style=\"left:" + lastPt.xPct.toFixed(2) + "%;top:" + lastPt.yPct.toFixed(2) + "%\">" +
"<div class=\"mp-chart-last-nav\">" + esc(fmtMoneyLocale(lastPt.h.navValue, currency)) + "</div>" +
"<div class=\"mp-chart-last-pct " + signClass(lastMetrics.returnPct) + "\">" + esc(fmtSignedPct(lastMetrics.returnPct)) + "</div>" +
"<div class=\"mp-chart-last-date\">" + esc(fmtDateLong(lastPt.h.asOfDate)) + "</div>" +
"</div>";

wrap.innerHTML =
"<div class=\"mp-chart-grid\">" +
"<div class=\"mp-chart-yaxis\">" + yTicksHtml + "</div>" +
"<div class=\"mp-chart-plot\">" + svg +
capitalLabelHtml +
"<div class=\"mp-chart-tooltip\" id=\"mpChartTooltip\" hidden></div>" +
lastBadgeHtml +
"</div>" +
"</div>" +
"<div class=\"mp-chart-xaxis\">" + xTicksHtml + "</div>";

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
? "<div class=\"mp-chart-tooltip-month\">" + esc(tfmt("chartMonthSinceFounding", { n: monthsSinceFounding(founded, p.h.asOfDate) })) + "</div>"
: "";
tooltip.innerHTML =
"<div class=\"mp-chart-tooltip-date\">" + esc(fmtDateLong(p.h.asOfDate)) + "</div>" +
monthLine +
"<div class=\"mp-chart-tooltip-row\">" + esc(t("chartTotalValue")) + ": <b>" + esc(fmtMoneyLocale(p.h.navValue, currency)) + "</b></div>" +
"<div class=\"mp-chart-tooltip-row\">" + esc(t("chartCapitalInvested")) + ": <b>" + esc(fmtMoneyLocale(p.h.capitalContributed, currency)) + "</b></div>" +
"<div class=\"mp-chart-tooltip-row " + signClass(m.profitLoss) + "\">" + esc(t("chartProfit")) + ": <b>" + esc(fmtSignedMoney(m.profitLoss, currency)) + "</b></div>" +
"<div class=\"mp-chart-tooltip-row " + signClass(m.returnPct) + "\">" + esc(t("totalReturn")) + ": <b>" + esc(fmtSignedPct(m.returnPct)) + "</b></div>";
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
var translateY = (topPx - th - 14 < 0) ? "16px" : "calc(-100% - 14px)";

tooltip.style.left = leftPx + "px";
tooltip.style.top = topPx + "px";
tooltip.style.transform = "translate(" + translateX + ", " + translateY + ")";
}

function hideTooltip() { tooltip.hidden = true; }

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
/* Init */
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
