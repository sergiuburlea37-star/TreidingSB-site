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
let currentLang = "ro";

const translations = {
  ro: {
    riskStrip: "⚠️ Risc: Tranzacționarea CFD implică risc ridicat de pierdere. Site informativ independent.",
    mobileToggle: "Deschide meniul",
    nav: { home: "⌂ Home", ideas: "⌁ Idei de tranzacționare", portfolioUs: "$ Portofoliu US", portfolioEu: "€ Portofoliu EU", reports: "▤ Rapoarte", education: "◈ Educație", calendar: "▦ Calendar economic", contact: "✉ Contact" },
    memberButton: "♙ Cont membru",
    hero: {
      pill: "Idei de tranzacționare active · Membri",
      titlePre: "Tranzacționează mai bine cu",
      desc: "Strategii reale pe Forex și Gold, calendar economic live, idei de tranzacționare verificate și rapoarte săptămânale agregate din surse importante — totul într-un singur loc.",
      btnPrimary: "Vezi ideile de tranzacționare",
      btnSecondary: "Calendar economic"
    },
    subscribe: { label: "Abonează-te la rapoarte", desc: "Primești pe email notificări când publicăm rapoarte și analize noi pentru XAU/USD, XAG/USD, EUR/USD și GBP/USD.", placeholder: "Adresa ta de email", button: "Abonează-te", sending: "Se trimite...", success: "Te-ai abonat cu succes! Verifică-ți emailul.", error: "A apărut o eroare. Te rugăm încearcă din nou puțin mai târziu.", invalid: "Te rugăm introdu o adresă de email validă." },
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
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact pentru membri, rapoarte și idei de tranzacționare.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Capital Total", statStocksEtf: "Acțiuni / ETF", statInstruments: "Instrumente", statReturn: "Randament anual", statVolatility: "Volatilitate", statHorizon: "Orizont", statBuffer: "Buffer Defensiv", tableHead: "Detalii complete — toate pozițiile", colTicker: "Ticker", colInstrument: "Instrument", colType: "Tip", colSector: "Sector", colRisk: "Risc", disclaimerLabel: "Disclaimer:" },
    portfolioUs: { eyebrow: "Portofoliu", title: "Portofoliu US", desc: "Portofoliu diversificat demonstrativ, risc moderat, orizont 3–5 ani · Fondat 17.06.2026", disclaimer: "Portofoliu demonstrativ cu scop educativ. Nu constituie consiliere de investiții. Consultă un advisor financiar autorizat FCA înainte de a investi. Performanțele trecute nu garantează rezultate viitoare." },
    portfolioEu: { eyebrow: "Portofoliu", title: "Portofoliu European Moderat+", desc: "Strategie pe 3–5 ani, intrare în tranșe, control al riscului · Fondat 17.06.2026", statAssets: "Active Totale", statStocks: "Acțiuni Individuale", statMaxPos: "Max. per Poziție", regionEurope: "Europa (Core)", regionUs: "SUA / Tech Global", tableHead: "Toate pozițiile — privire de ansamblu", colCompany: "Companie", bufferHead: "Componente Buffer Defensiv", colComponent: "Componentă", colEstReturn: "Randament Est.", colLiquidity: "Lichiditate", tranche1: "Tranșa 1", tranche1Desc: "Intrare inițială în pozițiile core (ASML, SAP, L'Oréal, Apple, ETF buffer). Cumperi doar dacă setup-ul tehnic este acceptabil — fără grabă.", tranche2: "Tranșa 2", tranche2Desc: "După confirmări: trend peste mediile mobile, rezultate financiare bune, fără șocuri macro. Adaugi SPCX, Google, Safran, Prysmian.", tranche3: "Tranșa 3", tranche3Desc: "Rezervată pentru corecții, pullback-uri sau rotații sectoriale. Cea mai mare tranșă — pentru că piața îți va oferi oportunități mai bune decât astăzi.", disclaimer: "Document cu scop educațional și informativ — nu reprezintă recomandare de investiții personalizată. Verifică prețurile, comisioanele, taxele și riscurile înainte de orice decizie. Performanțele trecute nu garantează rezultate viitoare." }
  },
  en: {
    riskStrip: "⚠️ Risk: CFD trading carries a high risk of loss. Independent informational site.",
    mobileToggle: "Open menu",
    nav: { home: "⌂ Home", ideas: "⌁ Trade Ideas", portfolioUs: "$ US Portfolio", portfolioEu: "€ EU Portfolio", reports: "▤ Reports", education: "◈ Education", calendar: "▦ Economic Calendar", contact: "✉ Contact" },
    memberButton: "♙ Member Area",
    hero: {
      pill: "Active trade ideas · Members",
      titlePre: "Trade smarter with",
      desc: "Real Forex and Gold strategies, live economic calendar, verified trade ideas and weekly reports aggregated from top sources — all in one place.",
      btnPrimary: "View trade ideas",
      btnSecondary: "Economic calendar"
    },
    subscribe: { label: "Subscribe to reports", desc: "Get email notifications when we publish new reports and analysis for XAU/USD, XAG/USD, EUR/USD and GBP/USD.", placeholder: "Your email address", button: "Subscribe", sending: "Sending...", success: "You're subscribed! Check your inbox.", error: "Something went wrong. Please try again shortly.", invalid: "Please enter a valid email address." },
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
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact for members, reports and trade ideas.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Total Capital", statStocksEtf: "Stocks / ETF", statInstruments: "Instruments", statReturn: "Annual Return", statVolatility: "Volatility", statHorizon: "Horizon", statBuffer: "Defensive Buffer", tableHead: "Full details — all positions", colTicker: "Ticker", colInstrument: "Instrument", colType: "Type", colSector: "Sector", colRisk: "Risk", disclaimerLabel: "Disclaimer:" },
    portfolioUs: { eyebrow: "Portfolio", title: "US Portfolio", desc: "Demonstration diversified portfolio, moderate risk, 3–5 year horizon · Founded 17.06.2026", disclaimer: "Demonstration portfolio for educational purposes. Not investment advice. Consult an FCA-authorised financial advisor before investing. Past performance does not guarantee future results." },
    portfolioEu: { eyebrow: "Portfolio", title: "European Moderate+ Portfolio", desc: "3–5 year strategy, phased entry, risk control · Founded 17.06.2026", statAssets: "Total Assets", statStocks: "Individual Stocks", statMaxPos: "Max. per Position", regionEurope: "Europe (Core)", regionUs: "US / Global Tech", tableHead: "All positions — overview", colCompany: "Company", bufferHead: "Defensive Buffer Components", colComponent: "Component", colEstReturn: "Est. Return", colLiquidity: "Liquidity", tranche1: "Tranche 1", tranche1Desc: "Initial entry into core positions (ASML, SAP, L'Oréal, Apple, buffer ETF). Buy only if the technical setup is acceptable — no rush.", tranche2: "Tranche 2", tranche2Desc: "After confirmations: trend above moving averages, good earnings, no macro shocks. Add SPCX, Google, Safran, Prysmian.", tranche3: "Tranche 3", tranche3Desc: "Reserved for corrections, pullbacks or sector rotations. The largest tranche — because the market will offer better opportunities than today.", disclaimer: "Educational and informational document — not personalised investment advice. Check prices, fees, taxes and risks before any decision. Past performance does not guarantee future results." }
  },
  ru: {
    riskStrip: "⚠️ Риск: Торговля CFD сопряжена с высоким риском потерь. Независимый информационный сайт.",
    mobileToggle: "Открыть меню",
    nav: { home: "⌂ Главная", ideas: "⌁ Торговые идеи", portfolioUs: "$ Портфель US", portfolioEu: "€ Портфель EU", reports: "▤ Отчёты", education: "◈ Обучение", calendar: "▦ Экономический календарь", contact: "✉ Контакты" },
    memberButton: "♙ Личный кабинет",
    hero: {
      pill: "Активные торговые идеи · Участники",
      titlePre: "Торгуйте разумнее с",
      desc: "Реальные стратегии по Forex и золоту, живой экономический календарь, проверенные торговые идеи и еженедельные отчёты из надёжных источников — всё в одном месте.",
      btnPrimary: "Смотреть торговые идеи",
      btnSecondary: "Экономический календарь"
    },
    subscribe: { label: "Подписаться на отчёты", desc: "Получайте уведомления на почту о новых отчётах и аналитике по XAU/USD, XAG/USD, EUR/USD и GBP/USD.", placeholder: "Ваш email", button: "Подписаться", sending: "Отправка...", success: "Вы подписались! Проверьте почту.", error: "Произошла ошибка. Попробуйте ещё раз чуть позже.", invalid: "Пожалуйста, введите корректный email." },
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
    contact: { eyebrow: "Контакты", title: "Контакты TreidingSB", desc: "Контакты для участников, отчётов и торговых идей.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Общий капитал", statStocksEtf: "Акции / ETF", statInstruments: "Инструменты", statReturn: "Годовая доходность", statVolatility: "Волатильность", statHorizon: "Горизонт", statBuffer: "Защитный буфер", tableHead: "Полная информация — все позиции", colTicker: "Тикер", colInstrument: "Инструмент", colType: "Тип", colSector: "Сектор", colRisk: "Риск", disclaimerLabel: "Дисклеймер:" },
    portfolioUs: { eyebrow: "Портфель", title: "Портфель US", desc: "Демонстрационный диверсифицированный портфель, умеренный риск, горизонт 3–5 лет · Основан 17.06.2026", disclaimer: "Демонстрационный портфель в образовательных целях. Не является инвестиционной рекомендацией. Проконсультируйтесь с финансовым советником, авторизованным FCA, перед инвестированием. Прошлые результаты не гарантируют будущих." },
    portfolioEu: { eyebrow: "Портфель", title: "Европейский портфель Умеренный+", desc: "Стратегия на 3–5 лет, поэтапный вход, контроль риска · Основан 17.06.2026", statAssets: "Всего активов", statStocks: "Отдельные акции", statMaxPos: "Макс. на позицию", regionEurope: "Европа (Ядро)", regionUs: "США / Глобальные технологии", tableHead: "Все позиции — обзор", colCompany: "Компания", bufferHead: "Компоненты защитного буфера", colComponent: "Компонент", colEstReturn: "Ожид. доходность", colLiquidity: "Ликвидность", tranche1: "Транш 1", tranche1Desc: "Начальный вход в основные позиции (ASML, SAP, L'Oréal, Apple, буферный ETF). Покупайте только при приемлемой технической картине — без спешки.", tranche2: "Транш 2", tranche2Desc: "После подтверждений: тренд выше скользящих средних, хорошая отчётность, отсутствие макрошоков. Добавляете SPCX, Google, Safran, Prysmian.", tranche3: "Транш 3", tranche3Desc: "Зарезервирован для коррекций, откатов или секторальных ротаций. Самый крупный транш — потому что рынок предложит возможности лучше, чем сегодня.", disclaimer: "Образовательный и информационный документ — не является персонализированной инвестиционной рекомендацией. Проверьте цены, комиссии, налоги и риски перед любым решением. Прошлые результаты не гарантируют будущих." }
  },
  uk: {
    riskStrip: "⚠️ Ризик: Торгівля CFD пов'язана з високим ризиком втрат. Незалежний інформаційний сайт.",
    mobileToggle: "Відкрити меню",
    nav: { home: "⌂ Головна", ideas: "⌁ Торгові ідеї", portfolioUs: "$ Портфель US", portfolioEu: "€ Портфель EU", reports: "▤ Звіти", education: "◈ Навчання", calendar: "▦ Економічний календар", contact: "✉ Контакти" },
    memberButton: "♙ Особистий кабінет",
    hero: {
      pill: "Активні торгові ідеї · Учасники",
      titlePre: "Торгуйте розумніше з",
      desc: "Реальні стратегії по Forex і золоту, живий економічний календар, перевірені торгові ідеї та щотижневі звіти з надійних джерел — усе в одному місці.",
      btnPrimary: "Переглянути торгові ідеї",
      btnSecondary: "Економічний календар"
    },
    subscribe: { label: "Підписатися на звіти", desc: "Отримуйте на пошту сповіщення про нові звіти та аналітику по XAU/USD, XAG/USD, EUR/USD і GBP/USD.", placeholder: "Ваша електронна адреса", button: "Підписатися", sending: "Надсилання...", success: "Ви підписалися! Перевірте пошту.", error: "Сталася помилка. Спробуйте ще раз трохи пізніше.", invalid: "Будь ласка, введіть коректну електронну адресу." },
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
    contact: { eyebrow: "Контакти", title: "Контакти TreidingSB", desc: "Контакти для учасників, звітів і торгових ідей.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Загальний капітал", statStocksEtf: "Акції / ETF", statInstruments: "Інструменти", statReturn: "Річна дохідність", statVolatility: "Волатильність", statHorizon: "Горизонт", statBuffer: "Захисний буфер", tableHead: "Повна інформація — всі позиції", colTicker: "Тікер", colInstrument: "Інструмент", colType: "Тип", colSector: "Сектор", colRisk: "Ризик", disclaimerLabel: "Застереження:" },
    portfolioUs: { eyebrow: "Портфель", title: "Портфель US", desc: "Демонстраційний диверсифікований портфель, помірний ризик, горизонт 3–5 років · Засновано 17.06.2026", disclaimer: "Демонстраційний портфель з освітньою метою. Не є інвестиційною рекомендацією. Проконсультуйтеся з фінансовим радником, авторизованим FCA, перед інвестуванням. Минулі результати не гарантують майбутніх." },
    portfolioEu: { eyebrow: "Портфель", title: "Європейський портфель Помірний+", desc: "Стратегія на 3–5 років, поетапний вхід, контроль ризику · Засновано 17.06.2026", statAssets: "Всього активів", statStocks: "Окремі акції", statMaxPos: "Макс. на позицію", regionEurope: "Європа (Ядро)", regionUs: "США / Глобальні технології", tableHead: "Всі позиції — огляд", colCompany: "Компанія", bufferHead: "Компоненти захисного буфера", colComponent: "Компонент", colEstReturn: "Оч. дохідність", colLiquidity: "Ліквідність", tranche1: "Транш 1", tranche1Desc: "Початковий вхід в основні позиції (ASML, SAP, L'Oréal, Apple, буферний ETF). Купуйте лише за прийнятної технічної картини — без поспіху.", tranche2: "Транш 2", tranche2Desc: "Після підтверджень: тренд вище ковзних середніх, гарна звітність, відсутність макрошоків. Додаєте SPCX, Google, Safran, Prysmian.", tranche3: "Транш 3", tranche3Desc: "Зарезервований для корекцій, відкатів або секторальних ротацій. Найбільший транш — бо ринок запропонує кращі можливості, ніж сьогодні.", disclaimer: "Освітній та інформаційний документ — не є персоналізованою інвестиційною рекомендацією. Перевірте ціни, комісії, податки та ризики перед будь-яким рішенням. Минулі результати не гарантують майбутніх." }
  },
  pl: {
    riskStrip: "⚠️ Ryzyko: Handel CFD wiąże się z wysokim ryzykiem straty. Niezależna strona informacyjna.",
    mobileToggle: "Otwórz menu",
    nav: { home: "⌂ Start", ideas: "⌁ Pomysły transakcyjne", portfolioUs: "$ Portfel US", portfolioEu: "€ Portfel EU", reports: "▤ Raporty", education: "◈ Edukacja", calendar: "▦ Kalendarz ekonomiczny", contact: "✉ Kontakt" },
    memberButton: "♙ Strefa członka",
    hero: {
      pill: "Aktywne pomysły transakcyjne · Członkowie",
      titlePre: "Handluj mądrzej z",
      desc: "Prawdziwe strategie na Forex i złoto, kalendarz ekonomiczny na żywo, sprawdzone pomysły transakcyjne i cotygodniowe raporty z najlepszych źródeł — wszystko w jednym miejscu.",
      btnPrimary: "Zobacz pomysły transakcyjne",
      btnSecondary: "Kalendarz ekonomiczny"
    },
    subscribe: { label: "Zapisz się na raporty", desc: "Otrzymuj powiadomienia e-mail, gdy publikujemy nowe raporty i analizy dla XAU/USD, XAG/USD, EUR/USD i GBP/USD.", placeholder: "Twój adres e-mail", button: "Zapisz się", sending: "Wysyłanie...", success: "Zapisano! Sprawdź swoją skrzynkę e-mail.", error: "Wystąpił błąd. Spróbuj ponownie za chwilę.", invalid: "Podaj prawidłowy adres e-mail." },
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
    contact: { eyebrow: "Kontakt", title: "Kontakt TreidingSB", desc: "Kontakt dla członków, raportów i pomysłów transakcyjnych.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Kapitał całkowity", statStocksEtf: "Akcje / ETF", statInstruments: "Instrumenty", statReturn: "Roczna stopa zwrotu", statVolatility: "Zmienność", statHorizon: "Horyzont", statBuffer: "Bufor Defensywny", tableHead: "Pełne szczegóły — wszystkie pozycje", colTicker: "Ticker", colInstrument: "Instrument", colType: "Typ", colSector: "Sektor", colRisk: "Ryzyko", disclaimerLabel: "Zastrzeżenie:" },
    portfolioUs: { eyebrow: "Portfel", title: "Portfel US", desc: "Demonstracyjny zdywersyfikowany portfel, umiarkowane ryzyko, horyzont 3–5 lat · Założony 17.06.2026", disclaimer: "Portfel demonstracyjny w celach edukacyjnych. Nie stanowi porady inwestycyjnej. Skonsultuj się z doradcą finansowym autoryzowanym przez FCA przed inwestowaniem. Wyniki historyczne nie gwarantują przyszłych rezultatów." },
    portfolioEu: { eyebrow: "Portfel", title: "Portfel Europejski Umiarkowany+", desc: "Strategia na 3–5 lat, wejście w transzach, kontrola ryzyka · Założony 17.06.2026", statAssets: "Wszystkich aktywów", statStocks: "Akcje indywidualne", statMaxPos: "Maks. na pozycję", regionEurope: "Europa (Rdzeń)", regionUs: "USA / Globalna technologia", tableHead: "Wszystkie pozycje — przegląd", colCompany: "Spółka", bufferHead: "Składniki bufora defensywnego", colComponent: "Składnik", colEstReturn: "Szac. zwrot", colLiquidity: "Płynność", tranche1: "Transza 1", tranche1Desc: "Początkowe wejście w pozycje core (ASML, SAP, L'Oréal, Apple, ETF bufora). Kupuj tylko jeśli układ techniczny jest akceptowalny — bez pośpiechu.", tranche2: "Transza 2", tranche2Desc: "Po potwierdzeniach: trend powyżej średnich kroczących, dobre wyniki finansowe, brak szoków makro. Dodajesz SPCX, Google, Safran, Prysmian.", tranche3: "Transza 3", tranche3Desc: "Zarezerwowana na korekty, cofnięcia lub rotacje sektorowe. Największa transza — bo rynek zaoferuje lepsze okazje niż dziś.", disclaimer: "Dokument edukacyjny i informacyjny — nie stanowi zindywidualizowanej porady inwestycyjnej. Sprawdź ceny, opłaty, podatki i ryzyko przed podjęciem decyzji. Wyniki historyczne nie gwarantują przyszłych rezultatów." }
  }
};

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function applyLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "ro";
  const dict = translations[lang];
  currentLang = lang;

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

/* ===================== Subscribe form ===================== */
const subscribeForm = document.getElementById("subscribeForm");
if (subscribeForm) {
  const emailInput = document.getElementById("subscribeEmail");
  const submitButton = document.getElementById("subscribeButton");
  const messageEl = document.getElementById("subscribeMessage");
  const buttonDefaultText = submitButton.textContent;

  subscribeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dict = translations[currentLang] || translations.ro;
    const email = (emailInput.value || "").trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    messageEl.classList.remove("is-error", "is-success");

    if (!emailPattern.test(email)) {
      messageEl.textContent = getNested(dict, "subscribe.invalid") || "Invalid email.";
      messageEl.classList.add("is-error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = getNested(dict, "subscribe.sending") || "...";
    messageEl.textContent = "";

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, type: "welcome", lang: currentLang })
      });

      let data = {};
      try { data = await response.json(); } catch (parseErr) { /* non-JSON response */ }

      if (!response.ok || !data.success) {
        throw new Error((data && data.error) || "Request failed");
      }

      messageEl.textContent = getNested(dict, "subscribe.success") || "Subscribed!";
      messageEl.classList.add("is-success");
      subscribeForm.reset();
    } catch (err) {
      messageEl.textContent = getNested(dict, "subscribe.error") || "Something went wrong.";
      messageEl.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = getNested(dict, "subscribe.button") || buttonDefaultText;
    }
  });
}

applyLanguage(detectInitialLang());
