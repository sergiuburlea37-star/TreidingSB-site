/* ===================== Mobile menu ===================== */
const menuButton = document.querySelector(".mobile-toggle");
const mainNav = document.querySelector(".main-nav");
if (menuButton && mainNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

/* ===================== i18n ===================== */
/* ISO country codes used by flagcdn.com for each site language (en -> gb flag) */
const FLAGS = { ro: "ro", en: "gb", ru: "ru", uk: "ua", pl: "pl" };
const CODES = { ro: "RO", en: "EN", ru: "RU", uk: "UA", pl: "PL" };
const SUPPORTED_LANGS = Object.keys(FLAGS);

const translations = {
  ro: {
    riskStrip: "⚠️ Risc: Tranzacționarea CFD implică risc ridicat de pierdere. Site informativ independent.",
    mobileToggle: "Deschide meniul",
    nav: { home: "⌂ Home", ideas: "⌁ Idei de tranzacționare", reports: "▤ Rapoarte", education: "◈ Educație", calendar: "▦ Calendar economic", contact: "✉ Contact" },
    memberButton: "♙ Cont membru",
    hero: {
      pill: "Idei de tranzacționare active · Membri",
      titlePre: "Tranzacționează mai bine cu",
      desc: "Strategii reale pe Forex și Gold, calendar economic live, idei de tranzacționare verificate și rapoarte săptămânale agregate din surse importante — totul într-un singur loc.",
      btnPrimary: "Vezi ideile de tranzacționare",
      btnSecondary: "Calendar economic"
    },
    subscribe: { label: "Abonează-te la rapoarte", desc: "Primești pe email notificări când publicăm rapoarte și analize noi pentru XAU/USD, XAG/USD, EUR/USD și GBP/USD.", placeholder: "Adresa ta de email", button: "Abonează-te" },
    ideas: {
      eyebrow: "Membri", title: "Idei de tranzacționare",
      desc: "Cardurile sunt pregătite pentru semnalele tale zilnice: activ, direcție, intrare, SL, TP și motiv tehnic.",
      card: { entryLabel: "Intrare:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Risc:" },
      card1: { riskValue: "Mediu", note: "Așteaptă confirmare M5/M15 înainte de intrare." },
      card2: { riskValue: "Scăzut", note: "Valid doar dacă USD slăbește după știri." }
    },
    reports: { eyebrow: "Rapoarte", title: "Rapoarte săptămânale", desc: "Analize tehnice, context de piață și perspective pentru săptămâna următoare.", panelTitle: "Analiză săptămânală", panelDesc: "O imagine completă asupra piețelor financiare pentru săptămâna curentă.", btn: "Vezi analiza săptămânală" },
    education: { eyebrow: "Educație", title: "Educație de bază", desc: "Învață cum funcționează piața, cine formează lichiditatea și cum gestionezi riscul." },
    calendar: { eyebrow: "Calendar", title: "Calendar economic", desc: "Aici vom integra calendarul economic pentru evenimente importante." },
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact pentru membri, rapoarte și idei de tranzacționare." }
  },
  en: {
    riskStrip: "⚠️ Risk: CFD trading carries a high risk of loss. Independent informational site.",
    mobileToggle: "Open menu",
    nav: { home: "⌂ Home", ideas: "⌁ Trade Ideas", reports: "▤ Reports", education: "◈ Education", calendar: "▦ Economic Calendar", contact: "✉ Contact" },
    memberButton: "♙ Member Area",
    hero: {
      pill: "Active trade ideas · Members",
      titlePre: "Trade smarter with",
      desc: "Real Forex and Gold strategies, live economic calendar, verified trade ideas and weekly reports aggregated from top sources — all in one place.",
      btnPrimary: "View trade ideas",
      btnSecondary: "Economic calendar"
    },
    subscribe: { label: "Subscribe to reports", desc: "Get email notifications when we publish new reports and analysis for XAU/USD, XAG/USD, EUR/USD and GBP/USD.", placeholder: "Your email address", button: "Subscribe" },
    ideas: {
      eyebrow: "Members", title: "Trade Ideas",
      desc: "Cards are ready for your daily signals: asset, direction, entry, SL, TP and technical reasoning.",
      card: { entryLabel: "Entry:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Risk:" },
      card1: { riskValue: "Medium", note: "Wait for M5/M15 confirmation before entering." },
      card2: { riskValue: "Low", note: "Valid only if USD weakens after the news." }
    },
    reports: { eyebrow: "Reports", title: "Weekly Reports", desc: "Technical analysis, market context and outlook for the coming week.", panelTitle: "Weekly Analysis", panelDesc: "A complete overview of financial markets for the current week.", btn: "View weekly analysis" },
    education: { eyebrow: "Education", title: "Trading Basics", desc: "Learn how the market works, who forms liquidity and how to manage risk." },
    calendar: { eyebrow: "Calendar", title: "Economic Calendar", desc: "We'll integrate the economic calendar for major events here." },
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact for members, reports and trade ideas." }
  },
  ru: {
    riskStrip: "⚠️ Риск: Торговля CFD сопряжена с высоким риском потерь. Независимый информационный сайт.",
    mobileToggle: "Открыть меню",
    nav: { home: "⌂ Главная", ideas: "⌁ Торговые идеи", reports: "▤ Отчёты", education: "◈ Обучение", calendar: "▦ Экономический календарь", contact: "✉ Контакты" },
    memberButton: "♙ Личный кабинет",
    hero: {
      pill: "Активные торговые идеи · Участники",
      titlePre: "Торгуйте разумнее с",
      desc: "Реальные стратегии по Forex и золоту, живой экономический календарь, проверенные торговые идеи и еженедельные отчёты из надёжных источников — всё в одном месте.",
      btnPrimary: "Смотреть торговые идеи",
      btnSecondary: "Экономический календарь"
    },
    subscribe: { label: "Подписаться на отчёты", desc: "Получайте уведомления на почту о новых отчётах и аналитике по XAU/USD, XAG/USD, EUR/USD и GBP/USD.", placeholder: "Ваш email", button: "Подписаться" },
    ideas: {
      eyebrow: "Участники", title: "Торговые идеи",
      desc: "Карточки готовы для ваших ежедневных сигналов: актив, направление, вход, SL, TP и техническое обоснование.",
      card: { entryLabel: "Вход:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Риск:" },
      card1: { riskValue: "Средний", note: "Дождитесь подтверждения на M5/M15 перед входом." },
      card2: { riskValue: "Низкий", note: "Актуально только при ослаблении USD после новостей." }
    },
    reports: { eyebrow: "Отчёты", title: "Еженедельные отчёты", desc: "Технический анализ, рыночный контекст и прогноз на следующую неделю.", panelTitle: "Еженедельный анализ", panelDesc: "Полный обзор финансовых рынков за текущую неделю.", btn: "Смотреть еженедельный анализ" },
    education: { eyebrow: "Обучение", title: "Основы трейдинга", desc: "Узнайте, как работает рынок, кто формирует ликвидность и как управлять риском." },
    calendar: { eyebrow: "Календарь", title: "Экономический календарь", desc: "Здесь будет интегрирован экономический календарь важных событий." },
    contact: { eyebrow: "Контакты", title: "Контакты TreidingSB", desc: "Контакты для участников, отчётов и торговых идей." }
  },
  uk: {
    riskStrip: "⚠️ Ризик: Торгівля CFD пов'язана з високим ризиком втрат. Незалежний інформаційний сайт.",
    mobileToggle: "Відкрити меню",
    nav: { home: "⌂ Головна", ideas: "⌁ Торгові ідеї", reports: "▤ Звіти", education: "◈ Навчання", calendar: "▦ Економічний календар", contact: "✉ Контакти" },
    memberButton: "♙ Особистий кабінет",
    hero: {
      pill: "Активні торгові ідеї · Учасники",
      titlePre: "Торгуйте розумніше з",
      desc: "Реальні стратегії по Forex і золоту, живий економічний календар, перевірені торгові ідеї та щотижневі звіти з надійних джерел — усе в одному місці.",
      btnPrimary: "Переглянути торгові ідеї",
      btnSecondary: "Економічний календар"
    },
    subscribe: { label: "Підписатися на звіти", desc: "Отримуйте на пошту сповіщення про нові звіти та аналітику по XAU/USD, XAG/USD, EUR/USD і GBP/USD.", placeholder: "Ваша електронна адреса", button: "Підписатися" },
    ideas: {
      eyebrow: "Учасники", title: "Торгові ідеї",
      desc: "Картки готові для ваших щоденних сигналів: актив, напрямок, вхід, SL, TP і технічне обґрунтування.",
      card: { entryLabel: "Вхід:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Ризик:" },
      card1: { riskValue: "Середній", note: "Зачекайте на підтвердження M5/M15 перед входом." },
      card2: { riskValue: "Низький", note: "Актуально лише якщо USD слабшає після новин." }
    },
    reports: { eyebrow: "Звіти", title: "Щотижневі звіти", desc: "Технічний аналіз, ринковий контекст та прогноз на наступний тиждень.", panelTitle: "Щотижневий аналіз", panelDesc: "Повний огляд фінансових ринків за поточний тиждень.", btn: "Переглянути щотижневий аналіз" },
    education: { eyebrow: "Навчання", title: "Основи трейдингу", desc: "Дізнайтеся, як працює ринок, хто формує ліквідність і як керувати ризиком." },
    calendar: { eyebrow: "Календар", title: "Економічний календар", desc: "Тут буде інтегровано економічний календар важливих подій." },
    contact: { eyebrow: "Контакти", title: "Контакти TreidingSB", desc: "Контакти для учасників, звітів і торгових ідей." }
  },
  pl: {
    riskStrip: "⚠️ Ryzyko: Handel CFD wiąże się z wysokim ryzykiem straty. Niezależna strona informacyjna.",
    mobileToggle: "Otwórz menu",
    nav: { home: "⌂ Start", ideas: "⌁ Pomysły transakcyjne", reports: "▤ Raporty", education: "◈ Edukacja", calendar: "▦ Kalendarz ekonomiczny", contact: "✉ Kontakt" },
    memberButton: "♙ Strefa członka",
    hero: {
      pill: "Aktywne pomysły transakcyjne · Członkowie",
      titlePre: "Handluj mądrzej z",
      desc: "Prawdziwe strategie na Forex i złoto, kalendarz ekonomiczny na żywo, sprawdzone pomysły transakcyjne i cotygodniowe raporty z najlepszych źródeł — wszystko w jednym miejscu.",
      btnPrimary: "Zobacz pomysły transakcyjne",
      btnSecondary: "Kalendarz ekonomiczny"
    },
    subscribe: { label: "Zapisz się na raporty", desc: "Otrzymuj powiadomienia e-mail, gdy publikujemy nowe raporty i analizy dla XAU/USD, XAG/USD, EUR/USD i GBP/USD.", placeholder: "Twój adres e-mail", button: "Zapisz się" },
    ideas: {
      eyebrow: "Członkowie", title: "Pomysły transakcyjne",
      desc: "Karty są gotowe na Twoje codzienne sygnały: aktywo, kierunek, wejście, SL, TP i uzasadnienie techniczne.",
      card: { entryLabel: "Wejście:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Ryzyko:" },
      card1: { riskValue: "Średnie", note: "Poczekaj na potwierdzenie M5/M15 przed wejściem." },
      card2: { riskValue: "Niskie", note: "Ważne tylko jeśli USD osłabnie po newsach." }
    },
    reports: { eyebrow: "Raporty", title: "Raporty tygodniowe", desc: "Analiza techniczna, kontekst rynkowy i perspektywy na nadchodzący tydzień.", panelTitle: "Analiza tygodniowa", panelDesc: "Pełny przegląd rynków finansowych w bieżącym tygodniu.", btn: "Zobacz analizę tygodniową" },
    education: { eyebrow: "Edukacja", title: "Podstawy tradingu", desc: "Dowiedz się, jak działa rynek, kto tworzy płynność i jak zarządzać ryzykiem." },
    calendar: { eyebrow: "Kalendarz", title: "Kalendarz ekonomiczny", desc: "Tutaj zintegrujemy kalendarz ekonomiczny ważnych wydarzeń." },
    contact: { eyebrow: "Kontakt", title: "Kontakt TreidingSB", desc: "Kontakt dla członków, raportów i pomysłów transakcyjnych." }
  }
};

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function applyLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "ro";
  const dict = translations[lang];

  document.documentElement.setAttribute("lang", lang);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const val = getNested(dict, el.getAttribute("data-i18n"));
    if (val !== undefined) el.textContent = val;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const val = getNested(dict, el.getAttribute("data-i18n-placeholder"));
    if (val !== undefined) el.setAttribute("placeholder", val);
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const val = getNested(dict, el.getAttribute("data-i18n-aria"));
    if (val !== undefined) el.setAttribute("aria-label", val);
  });

  const currentFlag = document.getElementById("langCurrentFlag");
  const currentCode = document.getElementById("langCurrentCode");
  if (currentFlag) {
    currentFlag.src = "https://flagcdn.com/" + FLAGS[lang] + ".svg";
    currentFlag.alt = CODES[lang];
  }
  if (currentCode) currentCode.textContent = CODES[lang];

  document.querySelectorAll("#langMenu button[data-lang]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
  });

  try { localStorage.setItem("tsb_lang", lang); } catch (e) { /* ignore storage errors */ }
}

function detectInitialLang() {
  try {
    const saved = localStorage.getItem("tsb_lang");
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (e) { /* ignore storage errors */ }

  const browserLang = (navigator.language || "ro").slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  return "ro";
}

/* ===================== Language switcher UI ===================== */
const langSwitcher = document.getElementById("langSwitcher");
const langCurrentBtn = document.getElementById("langCurrentBtn");
const langMenu = document.getElementById("langMenu");

if (langSwitcher && langCurrentBtn && langMenu) {
  langCurrentBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = langSwitcher.classList.toggle("is-open");
    langCurrentBtn.setAttribute("aria-expanded", String(isOpen));
  });

  langMenu.querySelectorAll("button[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.getAttribute("data-lang"));
      langSwitcher.classList.remove("is-open");
      langCurrentBtn.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (e) => {
    if (!langSwitcher.contains(e.target)) {
      langSwitcher.classList.remove("is-open");
      langCurrentBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      langSwitcher.classList.remove("is-open");
      langCurrentBtn.setAttribute("aria-expanded", "false");
    }
  });
}

applyLanguage(detectInitialLang());
