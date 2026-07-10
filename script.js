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
    nav: { home: "⌂ Home", about: "◎ Despre noi", ideas: "⌁ Idei de tranzacționare", portfolioUs: "$ Portofoliu US", portfolioEu: "€ Portofoliu EU", reports: "▤ Rapoarte", education: "◈ Educație", calendar: "▦ Calendar economic", contact: "✉ Contact" },
    memberButton: "♙ Cont membru",
    hero: {
      pill: "Idei de tranzacționare active · Membri",
      titlePre: "Tranzacționează mai bine cu",
      desc: "Strategii reale pe Forex și Gold, calendar economic live, idei de tranzacționare verificate și rapoarte săptămânale agregate din surse importante — totul într-un singur loc.",
      btnPrimary: "Vezi ideile de tranzacționare",
      btnSecondary: "Calendar economic"
    },
    subscribe: { label: "Abonează-te la rapoarte", desc: "Primești pe email notificări când publicăm rapoarte și analize noi pentru XAU/USD, XAG/USD, EUR/USD și GBP/USD.", placeholder: "Adresa ta de email", button: "Abonează-te", sending: "Se trimite...", success: "Te-ai abonat cu succes! Verifică-ți emailul.", error: "A apărut o eroare. Te rugăm încearcă din nou puțin mai târziu.", invalid: "Te rugăm introdu o adresă de email validă." },
    about: {
      eyebrow: "Despre noi", title: "Despre Treiding Satellite Broadcast",
      p1: "Treiding Satellite Broadcast este o platformă internațională de analiză financiară, construită în jurul unei echipe de specialiști din diferite țări. Echipa colaborează permanent într-un spațiu online, monitorizând piețele financiare globale și evaluând factorii economici, monetari și geopolitici care influențează fluxurile de capital și lichiditatea activelor.",
      p2: "Scopul nostru este să transformăm informațiile complexe în analize clare și valoroase, oferind membrilor noștri o perspectivă bine fundamentată asupra evoluției piețelor financiare. Fiecare analiză este realizată prin combinarea factorilor macroeconomici, politicilor monetare ale băncilor centrale, indicatorilor economici, fluxurilor de lichiditate, sentimentului investitorilor și evenimentelor geopolitice care pot influența prețul activelor financiare.",
      p3: "Echipa Treiding Satellite Broadcast acordă o atenție deosebită identificării surselor de lichiditate și zonelor cu probabilitate ridicată de reacție a pieței. Aceste informații sunt sintetizate în rapoarte și analize periodice, concepute pentru a ajuta traderii și investitorii să înțeleagă mai bine contextul pieței și să ia decizii informate.",
      assetsTitle: "Principalele active monitorizate",
      asset1: "Aur (XAU/USD)", asset2: "Argint (XAG/USD)", asset3: "Dolarul American (USD)", asset4: "Lira Sterlină (GBP)",
      p4: "Misiunea Treiding Satellite Broadcast nu este doar să urmărească graficele, ci să înțeleagă motivele reale din spatele mișcărilor pieței. Prin cercetare continuă, colaborare internațională și analiză obiectivă, oferim o imagine de ansamblu asupra tendințelor financiare globale și a oportunităților cu cel mai mare potențial.",
      p5: "Credem că succesul pe termen lung în piețele financiare se bazează pe disciplină, cunoaștere și gestionarea riscului. Din acest motiv, toate materialele publicate de Treiding Satellite Broadcast sunt dezvoltate cu profesionalism, transparență și responsabilitate, având ca obiectiv principal furnizarea unor informații de înaltă calitate și construirea unei comunități de traderi bine informați.",
      missionTitle: "Misiunea noastră", missionText: "Să transformăm informația financiară complexă în decizii mai bine fundamentate pentru fiecare membru al comunității noastre.",
      visionTitle: "Viziunea noastră", visionText: "Să devenim una dintre cele mai respectate platforme independente de analiză financiară la nivel internațional, recunoscută pentru profesionalism, transparență și calitatea informațiilor oferite.",
      satelliteTitle: "Ce înseamnă „Satellite Broadcast”?", satelliteText: "Conceptul Satellite Broadcast simbolizează transmiterea rapidă, continuă și globală a analizelor financiare către membrii platformei. Așa cum un satelit distribuie informații către întreaga lume, Treiding Satellite Broadcast conectează piețele financiare globale cu investitorii și traderii, oferindu-le acces la analize profesioniste, perspective strategice și informații relevante în timp util.",
      tagline: "Treiding Satellite Broadcast – Global Analysis. Intelligent Decisions. Worldwide Connection."
    },
    ideas: {
      eyebrow: "Membri", title: "Idei de tranzacționare",
      desc: "Cardurile sunt pregătite pentru semnalele tale zilnice: activ, direcție, intrare, SL, TP și motiv tehnic.",
      card: { entryLabel: "Intrare:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Risc:" },
      card1: { riskValue: "Mediu", note: "Așteaptă confirmare M5/M15 înainte de intrare." },
      card2: { riskValue: "Scăzut", note: "Valid doar dacă USD slăbește după știri." },
      gate: { title: "Acces Idei de Tranzacționare — Membri", desc: "Ideile de tranzacționare sunt disponibile exclusiv membrilor TreidingSB. Introdu parola pentru acces.", label: "Parolă acces", placeholder: "PAROLA ACCES", button: "Intră în cont", sending: "Se verifică...", noAccess: "Nu ai acces?", contact: "Contactează-ne pe Telegram", invalid: "Parolă incorectă. Încearcă din nou.", error: "A apărut o eroare. Te rugăm încearcă din nou." }
    },
    reports: { eyebrow: "Rapoarte", title: "Rapoarte săptămânale", desc: "Analize tehnice, context de piață și perspective pentru săptămâna următoare.", panelTitle: "Analiză săptămânală", panelDesc: "O imagine completă asupra piețelor financiare pentru săptămâna curentă.", btn: "Descarcă raportul PDF", loading: "Se caută cel mai recent raport...", latestLabel: "Ultimul raport:", unavailable: "Niciun raport disponibil momentan.", lockedText: "Conținutul este disponibil exclusiv membrilor. Accesează secțiunea Idei de tranzacționare pentru a introduce parola.", lockedLink: "Mergi la acces membri" },
    education: { eyebrow: "Educație", title: "Educație de bază", desc: "Învață cum funcționează piața, cine formează lichiditatea și cum gestionezi riscul." },
    calendar: { eyebrow: "Calendar", title: "Calendar economic", desc: "Aici vom integra calendarul economic pentru evenimente importante." },
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact pentru membri, rapoarte și idei de tranzacționare.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Capital Total", statStocksEtf: "Acțiuni / ETF", statInstruments: "Instrumente", statReturn: "Randament anual", statVolatility: "Volatilitate", statHorizon: "Orizont", statBuffer: "Buffer Defensiv", tableHead: "Detalii complete — toate pozițiile", colTicker: "Ticker", colInstrument: "Instrument", colType: "Tip", colSector: "Sector", colRisk: "Risc", disclaimerLabel: "Disclaimer:", swipeHint: "← Glisează pentru mai multe →" },
    portfolioUs: { eyebrow: "Portofoliu", title: "Portofoliu US", desc: "Portofoliu diversificat demonstrativ, risc moderat, orizont 3–5 ani · Fondat 17.06.2026", disclaimer: "Portofoliu demonstrativ cu scop educativ. Nu constituie consiliere de investiții. Consultă un advisor financiar autorizat FCA înainte de a investi. Performanțele trecute nu garantează rezultate viitoare." },
    portfolioEu: { eyebrow: "Portofoliu", title: "Portofoliu European Moderat+", desc: "Strategie pe 3–5 ani, intrare în tranșe, control al riscului · Fondat 17.06.2026", statAssets: "Active Totale", statStocks: "Acțiuni Individuale", statMaxPos: "Max. per Poziție", regionEurope: "Europa (Core)", regionUs: "SUA / Tech Global", tableHead: "Toate pozițiile — privire de ansamblu", colCompany: "Companie", bufferHead: "Componente Buffer Defensiv", colComponent: "Componentă", colEstReturn: "Randament Est.", colLiquidity: "Lichiditate", tranche1: "Tranșa 1", tranche1Desc: "Intrare inițială în pozițiile core (ASML, SAP, L'Oréal, Apple, ETF buffer). Cumperi doar dacă setup-ul tehnic este acceptabil — fără grabă.", tranche2: "Tranșa 2", tranche2Desc: "După confirmări: trend peste mediile mobile, rezultate financiare bune, fără șocuri macro. Adaugi SPCX, Google, Safran, Prysmian.", tranche3: "Tranșa 3", tranche3Desc: "Rezervată pentru corecții, pullback-uri sau rotații sectoriale. Cea mai mare tranșă — pentru că piața îți va oferi oportunități mai bune decât astăzi.", disclaimer: "Document cu scop educațional și informativ — nu reprezintă recomandare de investiții personalizată. Verifică prețurile, comisioanele, taxele și riscurile înainte de orice decizie. Performanțele trecute nu garantează rezultate viitoare." }
  },
  en: {
    riskStrip: "⚠️ Risk: CFD trading carries a high risk of loss. Independent informational site.",
    mobileToggle: "Open menu",
    nav: { home: "⌂ Home", about: "◎ About Us", ideas: "⌁ Trade Ideas", portfolioUs: "$ US Portfolio", portfolioEu: "€ EU Portfolio", reports: "▤ Reports", education: "◈ Education", calendar: "▦ Economic Calendar", contact: "✉ Contact" },
    memberButton: "♙ Member Area",
    hero: {
      pill: "Active trade ideas · Members",
      titlePre: "Trade smarter with",
      desc: "Real Forex and Gold strategies, live economic calendar, verified trade ideas and weekly reports aggregated from top sources — all in one place.",
      btnPrimary: "View trade ideas",
      btnSecondary: "Economic calendar"
    },
    subscribe: { label: "Subscribe to reports", desc: "Get email notifications when we publish new reports and analysis for XAU/USD, XAG/USD, EUR/USD and GBP/USD.", placeholder: "Your email address", button: "Subscribe", sending: "Sending...", success: "You're subscribed! Check your inbox.", error: "Something went wrong. Please try again shortly.", invalid: "Please enter a valid email address." },
    about: {
      eyebrow: "About Us", title: "About Treiding Satellite Broadcast",
      p1: "Treiding Satellite Broadcast is an international financial analysis platform built around a team of specialists from different countries. The team collaborates continuously in an online space, monitoring global financial markets and assessing the economic, monetary and geopolitical factors that influence capital flows and asset liquidity.",
      p2: "Our goal is to turn complex information into clear, valuable analysis, giving our members a well-grounded perspective on how financial markets are evolving. Each analysis combines macroeconomic factors, central bank monetary policy, economic indicators, liquidity flows, investor sentiment and geopolitical events that can influence asset prices.",
      p3: "The Treiding Satellite Broadcast team pays close attention to identifying liquidity sources and zones with a high probability of market reaction. This information is synthesized into periodic reports and analyses, designed to help traders and investors better understand market context and make informed decisions.",
      assetsTitle: "Main assets we monitor",
      asset1: "Gold (XAU/USD)", asset2: "Silver (XAG/USD)", asset3: "US Dollar (USD)", asset4: "British Pound (GBP)",
      p4: "The mission of Treiding Satellite Broadcast is not just to watch charts, but to understand the real reasons behind market moves. Through continuous research, international collaboration and objective analysis, we offer an overview of global financial trends and the opportunities with the greatest potential.",
      p5: "We believe long-term success in the financial markets is built on discipline, knowledge and risk management. That's why every piece of content published by Treiding Satellite Broadcast is developed with professionalism, transparency and responsibility, with the main goal of providing high-quality information and building a well-informed community of traders.",
      missionTitle: "Our Mission", missionText: "To turn complex financial information into better-grounded decisions for every member of our community.",
      visionTitle: "Our Vision", visionText: "To become one of the most respected independent financial analysis platforms internationally, recognized for professionalism, transparency and the quality of the information we provide.",
      satelliteTitle: "What does \"Satellite Broadcast\" mean?", satelliteText: "The concept of Satellite Broadcast symbolizes the fast, continuous and global transmission of financial analysis to platform members. Just as a satellite distributes information across the entire world, Treiding Satellite Broadcast connects global financial markets with investors and traders, giving them access to professional analysis, strategic perspectives and timely, relevant information.",
      tagline: "Treiding Satellite Broadcast – Global Analysis. Intelligent Decisions. Worldwide Connection."
    },
    ideas: {
      eyebrow: "Members", title: "Trade Ideas",
      desc: "Cards are ready for your daily signals: asset, direction, entry, SL, TP and technical reasoning.",
      card: { entryLabel: "Entry:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Risk:" },
      card1: { riskValue: "Medium", note: "Wait for M5/M15 confirmation before entering." },
      card2: { riskValue: "Low", note: "Valid only if USD weakens after the news." },
      gate: { title: "Trade Ideas Access — Members Only", desc: "Trade ideas are available exclusively to TreidingSB members. Enter the password to access.", label: "Access password", placeholder: "ACCESS PASSWORD", button: "Sign in", sending: "Checking...", noAccess: "No access?", contact: "Contact us on Telegram", invalid: "Incorrect password. Try again.", error: "Something went wrong. Please try again." }
    },
    reports: { eyebrow: "Reports", title: "Weekly Reports", desc: "Technical analysis, market context and outlook for the coming week.", panelTitle: "Weekly Analysis", panelDesc: "A complete overview of financial markets for the current week.", btn: "Download PDF report", loading: "Looking for the latest report...", latestLabel: "Latest report:", unavailable: "No report available yet.", lockedText: "This content is available exclusively to members. Go to the Trade Ideas section to enter the password.", lockedLink: "Go to member access" },
    education: { eyebrow: "Education", title: "Trading Basics", desc: "Learn how the market works, who forms liquidity and how to manage risk." },
    calendar: { eyebrow: "Calendar", title: "Economic Calendar", desc: "We'll integrate the economic calendar for major events here." },
    contact: { eyebrow: "Contact", title: "Contact TreidingSB", desc: "Contact for members, reports and trade ideas.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Total Capital", statStocksEtf: "Stocks / ETF", statInstruments: "Instruments", statReturn: "Annual Return", statVolatility: "Volatility", statHorizon: "Horizon", statBuffer: "Defensive Buffer", tableHead: "Full details — all positions", colTicker: "Ticker", colInstrument: "Instrument", colType: "Type", colSector: "Sector", colRisk: "Risk", disclaimerLabel: "Disclaimer:", swipeHint: "← Swipe for more →" },
    portfolioUs: { eyebrow: "Portfolio", title: "US Portfolio", desc: "Demonstration diversified portfolio, moderate risk, 3–5 year horizon · Founded 17.06.2026", disclaimer: "Demonstration portfolio for educational purposes. Not investment advice. Consult an FCA-authorised financial advisor before investing. Past performance does not guarantee future results." },
    portfolioEu: { eyebrow: "Portfolio", title: "European Moderate+ Portfolio", desc: "3–5 year strategy, phased entry, risk control · Founded 17.06.2026", statAssets: "Total Assets", statStocks: "Individual Stocks", statMaxPos: "Max. per Position", regionEurope: "Europe (Core)", regionUs: "US / Global Tech", tableHead: "All positions — overview", colCompany: "Company", bufferHead: "Defensive Buffer Components", colComponent: "Component", colEstReturn: "Est. Return", colLiquidity: "Liquidity", tranche1: "Tranche 1", tranche1Desc: "Initial entry into core positions (ASML, SAP, L'Oréal, Apple, buffer ETF). Buy only if the technical setup is acceptable — no rush.", tranche2: "Tranche 2", tranche2Desc: "After confirmations: trend above moving averages, good earnings, no macro shocks. Add SPCX, Google, Safran, Prysmian.", tranche3: "Tranche 3", tranche3Desc: "Reserved for corrections, pullbacks or sector rotations. The largest tranche — because the market will offer better opportunities than today.", disclaimer: "Educational and informational document — not personalised investment advice. Check prices, fees, taxes and risks before any decision. Past performance does not guarantee future results." }
  },
  ru: {
    riskStrip: "⚠️ Риск: Торговля CFD сопряжена с высоким риском потерь. Независимый информационный сайт.",
    mobileToggle: "Открыть меню",
    nav: { home: "⌂ Главная", about: "◎ О нас", ideas: "⌁ Торговые идеи", portfolioUs: "$ Портфель US", portfolioEu: "€ Портфель EU", reports: "▤ Отчёты", education: "◈ Обучение", calendar: "▦ Экономический календарь", contact: "✉ Контакты" },
    memberButton: "♙ Личный кабинет",
    hero: {
      pill: "Активные торговые идеи · Участники",
      titlePre: "Торгуйте разумнее с",
      desc: "Реальные стратегии по Forex и золоту, живой экономический календарь, проверенные торговые идеи и еженедельные отчёты из надёжных источников — всё в одном месте.",
      btnPrimary: "Смотреть торговые идеи",
      btnSecondary: "Экономический календарь"
    },
    subscribe: { label: "Подписаться на отчёты", desc: "Получайте уведомления на почту о новых отчётах и аналитике по XAU/USD, XAG/USD, EUR/USD и GBP/USD.", placeholder: "Ваш email", button: "Подписаться", sending: "Отправка...", success: "Вы подписались! Проверьте почту.", error: "Произошла ошибка. Попробуйте ещё раз чуть позже.", invalid: "Пожалуйста, введите корректный email." },
    about: {
      eyebrow: "О нас", title: "О Treiding Satellite Broadcast",
      p1: "Treiding Satellite Broadcast — международная платформа финансовой аналитики, созданная командой специалистов из разных стран. Команда постоянно работает в едином онлайн-пространстве, отслеживая мировые финансовые рынки и оценивая экономические, монетарные и геополитические факторы, влияющие на потоки капитала и ликвидность активов.",
      p2: "Наша цель — превращать сложную информацию в понятную и ценную аналитику, давая участникам обоснованное представление о развитии финансовых рынков. Каждый анализ строится на сочетании макроэкономических факторов, денежно-кредитной политики центральных банков, экономических показателей, потоков ликвидности, настроений инвесторов и геополитических событий, способных повлиять на цену активов.",
      p3: "Команда Treiding Satellite Broadcast уделяет особое внимание выявлению источников ликвидности и зон с высокой вероятностью реакции рынка. Эта информация обобщается в периодических отчётах и аналитике, призванных помочь трейдерам и инвесторам лучше понимать контекст рынка и принимать взвешенные решения.",
      assetsTitle: "Основные отслеживаемые активы",
      asset1: "Золото (XAU/USD)", asset2: "Серебро (XAG/USD)", asset3: "Доллар США (USD)", asset4: "Фунт стерлингов (GBP)",
      p4: "Миссия Treiding Satellite Broadcast — не просто следить за графиками, а понимать реальные причины движений рынка. Благодаря постоянным исследованиям, международному сотрудничеству и объективному анализу мы даём общую картину глобальных финансовых тенденций и возможностей с наибольшим потенциалом.",
      p5: "Мы верим, что долгосрочный успех на финансовых рынках строится на дисциплине, знаниях и управлении рисками. Поэтому все материалы, публикуемые Treiding Satellite Broadcast, создаются профессионально, прозрачно и ответственно, с главной целью — предоставлять качественную информацию и формировать сообщество хорошо информированных трейдеров.",
      missionTitle: "Наша миссия", missionText: "Превращать сложную финансовую информацию в более обоснованные решения для каждого участника нашего сообщества.",
      visionTitle: "Наше видение", visionText: "Стать одной из самых уважаемых независимых платформ финансовой аналитики на международном уровне, признанной за профессионализм, прозрачность и качество предоставляемой информации.",
      satelliteTitle: "Что означает «Satellite Broadcast»?", satelliteText: "Концепция Satellite Broadcast символизирует быструю, непрерывную и глобальную передачу финансовой аналитики участникам платформы. Подобно тому как спутник передаёт информацию по всему миру, Treiding Satellite Broadcast связывает мировые финансовые рынки с инвесторами и трейдерами, давая им доступ к профессиональной аналитике, стратегическим перспективам и своевременной, актуальной информации.",
      tagline: "Treiding Satellite Broadcast – Global Analysis. Intelligent Decisions. Worldwide Connection."
    },
    ideas: {
      eyebrow: "Участники", title: "Торговые идеи",
      desc: "Карточки готовы для ваших ежедневных сигналов: актив, направление, вход, SL, TP и техническое обоснование.",
      card: { entryLabel: "Вход:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Риск:" },
      card1: { riskValue: "Средний", note: "Дождитесь подтверждения на M5/M15 перед входом." },
      card2: { riskValue: "Низкий", note: "Актуально только при ослаблении USD после новостей." },
      gate: { title: "Доступ к торговым идеям — только для участников", desc: "Торговые идеи доступны исключительно участникам TreidingSB. Введите пароль для доступа.", label: "Пароль доступа", placeholder: "ПАРОЛЬ ДОСТУПА", button: "Войти", sending: "Проверка...", noAccess: "Нет доступа?", contact: "Свяжитесь с нами в Telegram", invalid: "Неверный пароль. Попробуйте ещё раз.", error: "Произошла ошибка. Попробуйте ещё раз." }
    },
    reports: { eyebrow: "Отчёты", title: "Еженедельные отчёты", desc: "Технический анализ, рыночный контекст и прогноз на следующую неделю.", panelTitle: "Еженедельный анализ", panelDesc: "Полный обзор финансовых рынков за текущую неделю.", btn: "Скачать PDF-отчёт", loading: "Поиск последнего отчёта...", latestLabel: "Последний отчёт:", unavailable: "Пока нет доступных отчётов.", lockedText: "Этот контент доступен исключительно участникам. Перейдите в раздел «Торговые идеи», чтобы ввести пароль.", lockedLink: "Перейти к доступу для участников" },
    education: { eyebrow: "Обучение", title: "Основы трейдинга", desc: "Узнайте, как работает рынок, кто формирует ликвидность и как управлять риском." },
    calendar: { eyebrow: "Календарь", title: "Экономический календарь", desc: "Здесь будет интегрирован экономический календарь важных событий." },
    contact: { eyebrow: "Контакты", title: "Контакты TreidingSB", desc: "Контакты для участников, отчётов и торговых идей.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Общий капитал", statStocksEtf: "Акции / ETF", statInstruments: "Инструменты", statReturn: "Годовая доходность", statVolatility: "Волатильность", statHorizon: "Горизонт", statBuffer: "Защитный буфер", tableHead: "Полная информация — все позиции", colTicker: "Тикер", colInstrument: "Инструмент", colType: "Тип", colSector: "Сектор", colRisk: "Риск", disclaimerLabel: "Дисклеймер:", swipeHint: "← Проведите пальцем, чтобы увидеть больше →" },
    portfolioUs: { eyebrow: "Портфель", title: "Портфель US", desc: "Демонстрационный диверсифицированный портфель, умеренный риск, горизонт 3–5 лет · Основан 17.06.2026", disclaimer: "Демонстрационный портфель в образовательных целях. Не является инвестиционной рекомендацией. Проконсультируйтесь с финансовым советником, авторизованным FCA, перед инвестированием. Прошлые результаты не гарантируют будущих." },
    portfolioEu: { eyebrow: "Портфель", title: "Европейский портфель Умеренный+", desc: "Стратегия на 3–5 лет, поэтапный вход, контроль риска · Основан 17.06.2026", statAssets: "Всего активов", statStocks: "Отдельные акции", statMaxPos: "Макс. на позицию", regionEurope: "Европа (Ядро)", regionUs: "США / Глобальные технологии", tableHead: "Все позиции — обзор", colCompany: "Компания", bufferHead: "Компоненты защитного буфера", colComponent: "Компонент", colEstReturn: "Ожид. доходность", colLiquidity: "Ликвидность", tranche1: "Транш 1", tranche1Desc: "Начальный вход в основные позиции (ASML, SAP, L'Oréal, Apple, буферный ETF). Покупайте только при приемлемой технической картине — без спешки.", tranche2: "Транш 2", tranche2Desc: "После подтверждений: тренд выше скользящих средних, хорошая отчётность, отсутствие макрошоков. Добавляете SPCX, Google, Safran, Prysmian.", tranche3: "Транш 3", tranche3Desc: "Зарезервирован для коррекций, откатов или секторальных ротаций. Самый крупный транш — потому что рынок предложит возможности лучше, чем сегодня.", disclaimer: "Образовательный и информационный документ — не является персонализированной инвестиционной рекомендацией. Проверьте цены, комиссии, налоги и риски перед любым решением. Прошлые результаты не гарантируют будущих." }
  },
  uk: {
    riskStrip: "⚠️ Ризик: Торгівля CFD пов'язана з високим ризиком втрат. Незалежний інформаційний сайт.",
    mobileToggle: "Відкрити меню",
    nav: { home: "⌂ Головна", about: "◎ Про нас", ideas: "⌁ Торгові ідеї", portfolioUs: "$ Портфель US", portfolioEu: "€ Портфель EU", reports: "▤ Звіти", education: "◈ Навчання", calendar: "▦ Економічний календар", contact: "✉ Контакти" },
    memberButton: "♙ Особистий кабінет",
    hero: {
      pill: "Активні торгові ідеї · Учасники",
      titlePre: "Торгуйте розумніше з",
      desc: "Реальні стратегії по Forex і золоту, живий економічний календар, перевірені торгові ідеї та щотижневі звіти з надійних джерел — усе в одному місці.",
      btnPrimary: "Переглянути торгові ідеї",
      btnSecondary: "Економічний календар"
    },
    subscribe: { label: "Підписатися на звіти", desc: "Отримуйте на пошту сповіщення про нові звіти та аналітику по XAU/USD, XAG/USD, EUR/USD і GBP/USD.", placeholder: "Ваша електронна адреса", button: "Підписатися", sending: "Надсилання...", success: "Ви підписалися! Перевірте пошту.", error: "Сталася помилка. Спробуйте ще раз трохи пізніше.", invalid: "Будь ласка, введіть коректну електронну адресу." },
    about: {
      eyebrow: "Про нас", title: "Про Treiding Satellite Broadcast",
      p1: "Treiding Satellite Broadcast — це міжнародна платформа фінансової аналітики, створена командою фахівців з різних країн. Команда постійно працює в єдиному онлайн-просторі, відстежуючи світові фінансові ринки та оцінюючи економічні, монетарні й геополітичні чинники, що впливають на потоки капіталу та ліквідність активів.",
      p2: "Наша мета — перетворювати складну інформацію на зрозумілу та цінну аналітику, надаючи учасникам обґрунтоване уявлення про розвиток фінансових ринків. Кожен аналіз поєднує макроекономічні чинники, монетарну політику центральних банків, економічні показники, потоки ліквідності, настрої інвесторів та геополітичні події, здатні вплинути на ціну активів.",
      p3: "Команда Treiding Satellite Broadcast приділяє особливу увагу виявленню джерел ліквідності та зон із високою ймовірністю реакції ринку. Ця інформація узагальнюється в періодичних звітах і аналітиці, покликаних допомогти трейдерам та інвесторам краще розуміти контекст ринку та ухвалювати зважені рішення.",
      assetsTitle: "Основні активи, які ми відстежуємо",
      asset1: "Золото (XAU/USD)", asset2: "Срібло (XAG/USD)", asset3: "Долар США (USD)", asset4: "Фунт стерлінгів (GBP)",
      p4: "Місія Treiding Satellite Broadcast — не просто стежити за графіками, а розуміти реальні причини руху ринку. Завдяки постійним дослідженням, міжнародній співпраці та об'єктивному аналізу ми даємо загальну картину глобальних фінансових тенденцій та можливостей із найбільшим потенціалом.",
      p5: "Ми віримо, що довгостроковий успіх на фінансових ринках базується на дисципліні, знаннях та управлінні ризиками. Тому всі матеріали, які публікує Treiding Satellite Broadcast, створюються професійно, прозоро та відповідально, з головною метою — надавати якісну інформацію та формувати спільноту добре поінформованих трейдерів.",
      missionTitle: "Наша місія", missionText: "Перетворювати складну фінансову інформацію на більш обґрунтовані рішення для кожного учасника нашої спільноти.",
      visionTitle: "Наше бачення", visionText: "Стати однією з найповажніших незалежних платформ фінансової аналітики на міжнародному рівні, визнаною за професіоналізм, прозорість та якість наданої інформації.",
      satelliteTitle: "Що означає «Satellite Broadcast»?", satelliteText: "Концепція Satellite Broadcast символізує швидку, безперервну та глобальну передачу фінансової аналітики учасникам платформи. Подібно до того, як супутник передає інформацію по всьому світу, Treiding Satellite Broadcast з'єднує світові фінансові ринки з інвесторами та трейдерами, надаючи їм доступ до професійної аналітики, стратегічних перспектив та своєчасної, актуальної інформації.",
      tagline: "Treiding Satellite Broadcast – Global Analysis. Intelligent Decisions. Worldwide Connection."
    },
    ideas: {
      eyebrow: "Учасники", title: "Торгові ідеї",
      desc: "Картки готові для ваших щоденних сигналів: актив, напрямок, вхід, SL, TP і технічне обґрунтування.",
      card: { entryLabel: "Вхід:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Ризик:" },
      card1: { riskValue: "Середній", note: "Зачекайте на підтвердження M5/M15 перед входом." },
      card2: { riskValue: "Низький", note: "Актуально лише якщо USD слабшає після новин." },
      gate: { title: "Доступ до торгових ідей — лише для учасників", desc: "Торгові ідеї доступні виключно учасникам TreidingSB. Введіть пароль для доступу.", label: "Пароль доступу", placeholder: "ПАРОЛЬ ДОСТУПУ", button: "Увійти", sending: "Перевірка...", noAccess: "Немає доступу?", contact: "Зв'яжіться з нами в Telegram", invalid: "Невірний пароль. Спробуйте ще раз.", error: "Сталася помилка. Спробуйте ще раз." }
    },
    reports: { eyebrow: "Звіти", title: "Щотижневі звіти", desc: "Технічний аналіз, ринковий контекст та прогноз на наступний тиждень.", panelTitle: "Щотижневий аналіз", panelDesc: "Повний огляд фінансових ринків за поточний тиждень.", btn: "Завантажити PDF-звіт", loading: "Пошук останнього звіту...", latestLabel: "Останній звіт:", unavailable: "Поки що немає доступних звітів.", lockedText: "Цей контент доступний виключно учасникам. Перейдіть до розділу «Торгові ідеї», щоб ввести пароль.", lockedLink: "Перейти до доступу для учасників" },
    education: { eyebrow: "Навчання", title: "Основи трейдингу", desc: "Дізнайтеся, як працює ринок, хто формує ліквідність і як керувати ризиком." },
    calendar: { eyebrow: "Календар", title: "Економічний календар", desc: "Тут буде інтегровано економічний календар важливих подій." },
    contact: { eyebrow: "Контакти", title: "Контакти TreidingSB", desc: "Контакти для учасників, звітів і торгових ідей.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Загальний капітал", statStocksEtf: "Акції / ETF", statInstruments: "Інструменти", statReturn: "Річна дохідність", statVolatility: "Волатильність", statHorizon: "Горизонт", statBuffer: "Захисний буфер", tableHead: "Повна інформація — всі позиції", colTicker: "Тікер", colInstrument: "Інструмент", colType: "Тип", colSector: "Сектор", colRisk: "Ризик", disclaimerLabel: "Застереження:", swipeHint: "← Проведіть пальцем, щоб побачити більше →" },
    portfolioUs: { eyebrow: "Портфель", title: "Портфель US", desc: "Демонстраційний диверсифікований портфель, помірний ризик, горизонт 3–5 років · Засновано 17.06.2026", disclaimer: "Демонстраційний портфель з освітньою метою. Не є інвестиційною рекомендацією. Проконсультуйтеся з фінансовим радником, авторизованим FCA, перед інвестуванням. Минулі результати не гарантують майбутніх." },
    portfolioEu: { eyebrow: "Портфель", title: "Європейський портфель Помірний+", desc: "Стратегія на 3–5 років, поетапний вхід, контроль ризику · Засновано 17.06.2026", statAssets: "Всього активів", statStocks: "Окремі акції", statMaxPos: "Макс. на позицію", regionEurope: "Європа (Ядро)", regionUs: "США / Глобальні технології", tableHead: "Всі позиції — огляд", colCompany: "Компанія", bufferHead: "Компоненти захисного буфера", colComponent: "Компонент", colEstReturn: "Оч. дохідність", colLiquidity: "Ліквідність", tranche1: "Транш 1", tranche1Desc: "Початковий вхід в основні позиції (ASML, SAP, L'Oréal, Apple, буферний ETF). Купуйте лише за прийнятної технічної картини — без поспіху.", tranche2: "Транш 2", tranche2Desc: "Після підтверджень: тренд вище ковзних середніх, гарна звітність, відсутність макрошоків. Додаєте SPCX, Google, Safran, Prysmian.", tranche3: "Транш 3", tranche3Desc: "Зарезервований для корекцій, відкатів або секторальних ротацій. Найбільший транш — бо ринок запропонує кращі можливості, ніж сьогодні.", disclaimer: "Освітній та інформаційний документ — не є персоналізованою інвестиційною рекомендацією. Перевірте ціни, комісії, податки та ризики перед будь-яким рішенням. Минулі результати не гарантують майбутніх." }
  },
  pl: {
    riskStrip: "⚠️ Ryzyko: Handel CFD wiąże się z wysokim ryzykiem straty. Niezależna strona informacyjna.",
    mobileToggle: "Otwórz menu",
    nav: { home: "⌂ Start", about: "◎ O nas", ideas: "⌁ Pomysły transakcyjne", portfolioUs: "$ Portfel US", portfolioEu: "€ Portfel EU", reports: "▤ Raporty", education: "◈ Edukacja", calendar: "▦ Kalendarz ekonomiczny", contact: "✉ Kontakt" },
    memberButton: "♙ Strefa członka",
    hero: {
      pill: "Aktywne pomysły transakcyjne · Członkowie",
      titlePre: "Handluj mądrzej z",
      desc: "Prawdziwe strategie na Forex i złoto, kalendarz ekonomiczny na żywo, sprawdzone pomysły transakcyjne i cotygodniowe raporty z najlepszych źródeł — wszystko w jednym miejscu.",
      btnPrimary: "Zobacz pomysły transakcyjne",
      btnSecondary: "Kalendarz ekonomiczny"
    },
    subscribe: { label: "Zapisz się na raporty", desc: "Otrzymuj powiadomienia e-mail, gdy publikujemy nowe raporty i analizy dla XAU/USD, XAG/USD, EUR/USD i GBP/USD.", placeholder: "Twój adres e-mail", button: "Zapisz się", sending: "Wysyłanie...", success: "Zapisano! Sprawdź swoją skrzynkę e-mail.", error: "Wystąpił błąd. Spróbuj ponownie za chwilę.", invalid: "Podaj prawidłowy adres e-mail." },
    about: {
      eyebrow: "O nas", title: "O Treiding Satellite Broadcast",
      p1: "Treiding Satellite Broadcast to międzynarodowa platforma analiz finansowych, zbudowana wokół zespołu specjalistów z różnych krajów. Zespół stale współpracuje w jednej przestrzeni online, monitorując globalne rynki finansowe i oceniając czynniki ekonomiczne, monetarne i geopolityczne wpływające na przepływy kapitału i płynność aktywów.",
      p2: "Naszym celem jest przekształcanie złożonych informacji w jasne i wartościowe analizy, dające naszym członkom dobrze uzasadnioną perspektywę rozwoju rynków finansowych. Każda analiza łączy czynniki makroekonomiczne, politykę monetarną banków centralnych, wskaźniki ekonomiczne, przepływy płynności, nastroje inwestorów oraz wydarzenia geopolityczne, które mogą wpływać na ceny aktywów.",
      p3: "Zespół Treiding Satellite Broadcast zwraca szczególną uwagę na identyfikację źródeł płynności oraz stref o wysokim prawdopodobieństwie reakcji rynku. Informacje te są syntetyzowane w okresowych raportach i analizach, mających pomóc traderom i inwestorom lepiej zrozumieć kontekst rynkowy i podejmować świadome decyzje.",
      assetsTitle: "Główne monitorowane aktywa",
      asset1: "Złoto (XAU/USD)", asset2: "Srebro (XAG/USD)", asset3: "Dolar amerykański (USD)", asset4: "Funt szterling (GBP)",
      p4: "Misją Treiding Satellite Broadcast nie jest jedynie obserwowanie wykresów, lecz zrozumienie prawdziwych przyczyn ruchów rynkowych. Dzięki ciągłym badaniom, międzynarodowej współpracy i obiektywnej analizie oferujemy pełny obraz globalnych trendów finansowych oraz możliwości o największym potencjale.",
      p5: "Wierzymy, że długoterminowy sukces na rynkach finansowych opiera się na dyscyplinie, wiedzy i zarządzaniu ryzykiem. Dlatego wszystkie materiały publikowane przez Treiding Satellite Broadcast są tworzone profesjonalnie, transparentnie i odpowiedzialnie, a ich głównym celem jest dostarczanie informacji wysokiej jakości i budowanie dobrze poinformowanej społeczności traderów.",
      missionTitle: "Nasza misja", missionText: "Przekształcanie złożonych informacji finansowych w lepiej uzasadnione decyzje dla każdego członka naszej społeczności.",
      visionTitle: "Nasza wizja", visionText: "Stać się jedną z najbardziej szanowanych niezależnych platform analiz finansowych na poziomie międzynarodowym, rozpoznawaną za profesjonalizm, transparentność i jakość dostarczanych informacji.",
      satelliteTitle: "Co oznacza „Satellite Broadcast”?", satelliteText: "Koncepcja Satellite Broadcast symbolizuje szybkie, ciągłe i globalne przekazywanie analiz finansowych członkom platformy. Tak jak satelita przekazuje informacje na cały świat, Treiding Satellite Broadcast łączy globalne rynki finansowe z inwestorami i traderami, dając im dostęp do profesjonalnych analiz, perspektyw strategicznych oraz aktualnych, istotnych informacji.",
      tagline: "Treiding Satellite Broadcast – Global Analysis. Intelligent Decisions. Worldwide Connection."
    },
    ideas: {
      eyebrow: "Członkowie", title: "Pomysły transakcyjne",
      desc: "Karty są gotowe na Twoje codzienne sygnały: aktywo, kierunek, wejście, SL, TP i uzasadnienie techniczne.",
      card: { entryLabel: "Wejście:", slLabel: "SL:", tpLabel: "TP:", riskLabel: "Ryzyko:" },
      card1: { riskValue: "Średnie", note: "Poczekaj na potwierdzenie M5/M15 przed wejściem." },
      card2: { riskValue: "Niskie", note: "Ważne tylko jeśli USD osłabnie po newsach." },
      gate: { title: "Dostęp do pomysłów transakcyjnych — tylko dla członków", desc: "Pomysły transakcyjne są dostępne wyłącznie dla członków TreidingSB. Wprowadź hasło, aby uzyskać dostęp.", label: "Hasło dostępu", placeholder: "HASŁO DOSTĘPU", button: "Zaloguj się", sending: "Sprawdzanie...", noAccess: "Brak dostępu?", contact: "Skontaktuj się z nami na Telegramie", invalid: "Nieprawidłowe hasło. Spróbuj ponownie.", error: "Wystąpił błąd. Spróbuj ponownie." }
    },
    reports: { eyebrow: "Raporty", title: "Raporty tygodniowe", desc: "Analiza techniczna, kontekst rynkowy i perspektywy na nadchodzący tydzień.", panelTitle: "Analiza tygodniowa", panelDesc: "Pełny przegląd rynków finansowych w bieżącym tygodniu.", btn: "Pobierz raport PDF", loading: "Szukanie najnowszego raportu...", latestLabel: "Najnowszy raport:", unavailable: "Brak dostępnych raportów.", lockedText: "Ta treść jest dostępna wyłącznie dla członków. Przejdź do sekcji Pomysły transakcyjne, aby wprowadzić hasło.", lockedLink: "Przejdź do dostępu dla członków" },
    education: { eyebrow: "Edukacja", title: "Podstawy tradingu", desc: "Dowiedz się, jak działa rynek, kto tworzy płynność i jak zarządzać ryzykiem." },
    calendar: { eyebrow: "Kalendarz", title: "Kalendarz ekonomiczny", desc: "Tutaj zintegrujemy kalendarz ekonomiczny ważnych wydarzeń." },
    contact: { eyebrow: "Kontakt", title: "Kontakt TreidingSB", desc: "Kontakt dla członków, raportów i pomysłów transakcyjnych.", emailLabel: "Email:", telegramLabel: "Telegram:" },
    portfolio: { statCapital: "Kapitał całkowity", statStocksEtf: "Akcje / ETF", statInstruments: "Instrumenty", statReturn: "Roczna stopa zwrotu", statVolatility: "Zmienność", statHorizon: "Horyzont", statBuffer: "Bufor Defensywny", tableHead: "Pełne szczegóły — wszystkie pozycje", colTicker: "Ticker", colInstrument: "Instrument", colType: "Typ", colSector: "Sektor", colRisk: "Ryzyko", disclaimerLabel: "Zastrzeżenie:", swipeHint: "← Przesuń, aby zobaczyć więcej →" },
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

  if (typeof unlockedIdeas !== "undefined" && unlockedIdeas) renderIdeaCards(unlockedIdeas);
  if (typeof latestReportInfo !== "undefined" && latestReportInfo) renderReportStatus();
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

/* ===================== Trade ideas access gate ===================== */
const IDEAS_TOKEN_KEY = "tsb_member_token";
let unlockedIdeas = null;

function renderIdeaCards(ideas) {
  const grid = document.getElementById("ideasGrid");
  if (!grid || !Array.isArray(ideas)) return;
  const dict = translations[currentLang] || translations.ro;
  const entryLabel = getNested(dict, "ideas.card.entryLabel") || "Entry:";
  const slLabel = getNested(dict, "ideas.card.slLabel") || "SL:";
  const tpLabel = getNested(dict, "ideas.card.tpLabel") || "TP:";
  const riskLabel = getNested(dict, "ideas.card.riskLabel") || "Risk:";

  grid.innerHTML = ideas.map((idea) => {
    const sideClass = idea.side === "BUY" ? "buy" : "sell";
    const riskValue = getNested(dict, idea.riskKey) || "";
    const note = getNested(dict, idea.noteKey) || "";
    return "<article class=\"idea-card\"><div class=\"idea-top\"><strong>" + idea.ticker + "</strong><span class=\"" + sideClass + "\">" + idea.side + "</span></div><ul><li><b>" + entryLabel + "</b> " + idea.entry + "</li><li><b>" + slLabel + "</b> " + idea.sl + "</li><li><b>" + tpLabel + "</b> " + idea.tp + "</li><li><b>" + riskLabel + "</b> <span>" + riskValue + "</span></li></ul><p>" + note + "</p></article>";
  }).join("");
}

function unlockIdeas(ideas) {
  unlockedIdeas = ideas;
  renderIdeaCards(ideas);
  const gate = document.getElementById("ideasGate");
  const grid = document.getElementById("ideasGrid");
  if (gate) gate.setAttribute("hidden", "");
  if (grid) grid.removeAttribute("hidden");
  unlockReports();
}

function unlockReports() {
  const locked = document.getElementById("reportLocked");
  const panel = document.getElementById("reportPanel");
  if (locked) locked.setAttribute("hidden", "");
  if (panel) panel.removeAttribute("hidden");
  loadLatestReport();
}

async function fetchIdeasWithToken(token) {
  const response = await fetch("/api/ideas", {
    headers: { Authorization: "Bearer " + token }
  });
  if (!response.ok) throw new Error("unauthorized");
  const data = await response.json();
  if (!data.success || !Array.isArray(data.ideas)) throw new Error("bad response");
  return data.ideas;
}

// Deblocare automată dacă există deja un token valid, stocat la o vizită anterioară.
(function tryStoredAccess() {
  let token = null;
  try { token = localStorage.getItem(IDEAS_TOKEN_KEY); } catch (e) { /* ignore storage errors */ }
  if (!token) return;
  fetchIdeasWithToken(token)
    .then((ideas) => unlockIdeas(ideas))
    .catch(() 