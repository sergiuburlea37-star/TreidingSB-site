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
    education: { eyebrow: "Educație", title: "Educație de bază", desc: "Învață cum funcționează piața, cine formează lichiditatea și cum gestionezi riscul.",
      lesson: {
        eyebrow: "🎓 Lecție educativă", title: "Cine formează Piața Forex?",
        intro: "Piața Forex este cea mai mare piață financiară din lume, cu un volum zilnic de peste 7 trilioane USD. Mișcările valutelor nu sunt întâmplătoare. Ele sunt influențate de patru mari forțe.",
        actorsHead: "Cei 4 actori principali ai pieței Forex",
        examplesLabel: "Exemple:", impactLabel: "Impact:",
        actor1: { title: "1. Băncile Centrale", subtitle: "Arhitecții economiei mondiale", point1: "Controlează politica monetară.", point2: "Decid dobânda, lichiditatea, inflația și stabilitatea monedei.", examples: "FED · Bank of England · European Central Bank · Bank of Japan", impact: "Dacă o bancă centrală mărește dobânda, moneda acelei țări devine mai atractivă și se apreciază." },
        actor2: { title: "2. Băncile Investiționale", subtitle: "Motorul lichidității", point1: "Execută ordine de miliarde de dolari.", point2: "Oferă lichiditate și creează piețe.", point3: "Tranzacționează pentru clienți și instituții mari.", examples: "Goldman Sachs · JPMorgan Chase & Co. · Citi · UBS", impact: "Ordinele mari executate de bănci pot mișca puternic piața și pot crea noi zone de lichiditate." },
        actor3: { title: "3. Fondurile de Investiții", subtitle: "Capitalul care mută piețele", point1: "Administrează miliarde sau trilioane de dolari.", point2: "Scopul: protejarea și creșterea capitalului.", point3: "Cumpără și vând în funcție de strategie și perspectivă.", examples: "BlackRock · Vanguard · Fidelity · Bridgewater", impact: "Fluxurile mari de capital pot crește sau scădea puternic cererea și oferta pe piață." },
        actor4: { title: "4. Evenimente Geopolitice", subtitle: "Factorul imprevizibil", point1: "Evenimentele globale schimbă sentimentul pieței.", point2: "Războaie, sancțiuni, alegeri, crize energetice, pandemii, acorduri comerciale și altele.", examples: "Războaie · Alegeri · Crize energetice · Acorduri", impact: "Investitorii caută siguranță sau oportunități, iar piețele reacționează rapid și puternic." },
        flowTitle: "Cum circulă informația în piață?",
        flowText: "Informația pornește de la evenimentele economice și deciziile globale, este procesată de marile instituții și ajunge până la traderii retail. Înțelegerea acestui flux te ajută să vezi imaginea completă.",
        flow1: "Evenimente Economice", flow2: "Băncile Centrale", flow3: "Băncile Investiționale", flow4: "Fondurile de Investiții", flow5: "Brokerii / Instituțiile", flow6: "Traderii Retail",
        philosophyTitle: "Filosofia Treiding Satellite Broadcast",
        philosophyText: "Un trader de succes nu urmărește doar graficele. El înțelege de ce se mișcă piața. La Treiding Satellite Broadcast analizăm permanent cele 4 forțe care influențează piața Forex și distribuim informația către membrii noștri, astfel încât tu să iei decizii informate și să fii mereu cu un pas înainte.",
        badge1: "📈 Analiză profundă", badge2: "🕐 Informație în timp real", badge3: "🌐 Viziune globală", badge4: "🎯 Decizii inteligente",
        disclaimer: "Trading implică risc. Performanțele anterioare nu garantează rezultatele viitoare. Informațiile de pe acest site au scop educativ și nu reprezintă sfat financiar."
      },
      forces: {
        head: "10 Forțe Reale pe Piața Forex", subhead: "Cine mișcă piața valutară și de ce contează",
        item1: { title: "Băncile Centrale", desc: "Controlează dobânzile, lichiditatea și economia." },
        item2: { title: "Băncile de Investiții", desc: "Execută ordine mari și oferă lichiditate pieței." },
        item3: { title: "Fondurile de Investiții", desc: "Mută miliarde de dolari între valute, aur, acțiuni și obligațiuni." },
        item4: { title: "Market Makerii", desc: "Asigură cumpărători și vânzători și mențin piața în mișcare." },
        item5: { title: "Calendarul Economic", desc: "Știrile importante care pot mări volatilitatea." },
        item6: { title: "Evenimentele Geopolitice", desc: "Războaie, alegeri, sancțiuni și crize care schimbă sentimentul pieței." },
        item7: { title: "Lichiditatea", desc: "Combustibilul pieței. Fără lichiditate, piața nu se mișcă." },
        item8: { title: "Fluxul Capitalului", desc: "Banii se mută mereu între active. Înțelegerea fluxului = avantaj." },
        item9: { title: "Traderii Retail", desc: "Milioane de traderi individuali care contribuie la lichiditate." },
        item10: { title: "Algoritmii (HFT & AI)", desc: "Execută tranzacții în milisecunde și procesează volume uriașe de date." },
        cta: "Înțelege forțele. Urmărește piața. Trading inteligent."
      }
    },
    calendar: { eyebrow: "Calendar", title: "Calendar economic", desc: "Evenimente economice live, actualizate în timp real — sursă TradingView.",
      lesson: {
        head: "Eroii Calendarului Economic", subhead: "Cei mai importanți indicatori care mișcă piețele",
        item1: { title: "NFP", subtitle: "Non-Farm Payrolls", desc: "Numărul de locuri de muncă noi create în SUA, în afara sectorului agricol. Unul dintre cei mai așteptați indicatori lunari — poate mișca puternic USD și piețele bursiere.", nickname: "Regele locurilor de muncă" },
        item2: { title: "CPI", subtitle: "Consumer Price Index", desc: "Măsoară variația prețurilor de consum și indică nivelul inflației. Un CPI mai mare decât așteptările poate determina băncile centrale să majoreze dobânzile.", nickname: "Regele Inflației" },
        item3: { title: "Interest Rate", subtitle: "Decizia Dobânzii", desc: "Decizia oficială privind rata dobânzii de referință. Are impact direct asupra valorii monedei, costului creditelor și apetitului investitorilor pentru risc.", nickname: "Șeful Băncilor Centrale" },
        item4: { title: "Powell Speech", subtitle: "Discursul Președintelui FED", desc: "Declarațiile președintelui Rezervei Federale americane pot confirma sau schimba așteptările pieței privind politica monetară — și pot provoca mișcări bruște.", nickname: "Vocea care mișcă piețele" },
        item5: { title: "GDP", subtitle: "Gross Domestic Product", desc: "Valoarea totală a bunurilor și serviciilor produse într-o economie. Arată dacă economia crește sau încetinește, influențând încrederea investitorilor.", nickname: "Puterea Economiei" },
        item6: { title: "PMI", subtitle: "Purchasing Managers' Index", desc: "Sondaj lunar în rândul managerilor de achiziții, care arată dacă activitatea din industrie și servicii se extinde sau se contractă.", nickname: "Sănătatea Industriei" },
        item7: { title: "Retail Sales", subtitle: "Vânzările cu Amănuntul", desc: "Măsoară cheltuielile consumatorilor în magazine. Un consum puternic susține creșterea economică; o scădere poate semnala încetinire.", nickname: "Puterea Consumatorului" },
        item8: { title: "Unemployment Rate", subtitle: "Rata Șomajului", desc: "Procentul persoanelor apte de muncă aflate în căutarea unui loc de muncă. Un șomaj scăzut indică o economie sănătoasă, dar poate alimenta și inflația.", nickname: "Barometrul Locurilor de Muncă" },
        item9: { title: "PPI", subtitle: "Producer Price Index", desc: "Măsoară variația prețurilor la nivel de producători, adesea un semnal timpuriu pentru inflația care va ajunge la consumatori (CPI).", nickname: "Inflația din Producție" },
        item10: { title: "FOMC Minutes", subtitle: "Procesul Verbal FOMC", desc: "Procesul-verbal detaliat al ședinței Comitetului Federal pentru Piața Deschisă, cu explicații despre motivele deciziilor de politică monetară.", nickname: "Citește între rânduri" },
        cta: "Fiecare erou are puterea de a mișca piața. Urmărește-i. Înțelege-i. Profită de ei."
      }
    },
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
    education: { eyebrow: "Education", title: "Trading Basics", desc: "Learn how the market works, who forms liquidity and how to manage risk.",
      lesson: {
        eyebrow: "🎓 Educational lesson", title: "Who Forms the Forex Market?",
        intro: "The Forex market is the largest financial market in the world, with a daily volume of over 7 trillion USD. Currency movements are not random. They are driven by four major forces.",
        actorsHead: "The 4 main players in the Forex market",
        examplesLabel: "Examples:", impactLabel: "Impact:",
        actor1: { title: "1. Central Banks", subtitle: "The architects of the global economy", point1: "Control monetary policy.", point2: "Decide interest rates, liquidity, inflation and currency stability.", examples: "FED · Bank of England · European Central Bank · Bank of Japan", impact: "If a central bank raises interest rates, that country's currency becomes more attractive and appreciates." },
        actor2: { title: "2. Investment Banks", subtitle: "The engine of liquidity", point1: "Execute billion-dollar orders.", point2: "Provide liquidity and create markets.", point3: "Trade on behalf of clients and large institutions.", examples: "Goldman Sachs · JPMorgan Chase & Co. · Citi · UBS", impact: "Large orders executed by banks can move the market strongly and create new liquidity zones." },
        actor3: { title: "3. Investment Funds", subtitle: "The capital that moves markets", point1: "Manage billions or trillions of dollars.", point2: "Goal: protecting and growing capital.", point3: "Buy and sell based on strategy and outlook.", examples: "BlackRock · Vanguard · Fidelity · Bridgewater", impact: "Large capital flows can sharply increase or decrease supply and demand in the market." },
        actor4: { title: "4. Geopolitical Events", subtitle: "The unpredictable factor", point1: "Global events shift market sentiment.", point2: "Wars, sanctions, elections, energy crises, pandemics, trade agreements and more.", examples: "Wars · Elections · Energy crises · Agreements", impact: "Investors seek safety or opportunity, and markets react quickly and strongly." },
        flowTitle: "How does information flow through the market?",
        flowText: "Information starts with economic events and global decisions, gets processed by major institutions, and reaches retail traders. Understanding this flow helps you see the full picture.",
        flow1: "Economic Events", flow2: "Central Banks", flow3: "Investment Banks", flow4: "Investment Funds", flow5: "Brokers / Institutions", flow6: "Retail Traders",
        philosophyTitle: "The Treiding Satellite Broadcast Philosophy",
        philosophyText: "A successful trader doesn't just watch the charts. They understand why the market moves. At Treiding Satellite Broadcast, we constantly analyze the 4 forces that influence the Forex market and share that information with our members, so you can make informed decisions and stay one step ahead.",
        badge1: "📈 In-depth analysis", badge2: "🕐 Real-time information", badge3: "🌐 Global vision", badge4: "🎯 Smart decisions",
        disclaimer: "Trading involves risk. Past performance does not guarantee future results. Information on this site is for educational purposes only and does not constitute financial advice."
      },
      forces: {
        head: "10 Real Forces in the Forex Market", subhead: "Who moves the currency market and why it matters",
        item1: { title: "Central Banks", desc: "Control interest rates, liquidity and the economy." },
        item2: { title: "Investment Banks", desc: "Execute large orders and provide liquidity to the market." },
        item3: { title: "Investment Funds", desc: "Move billions of dollars between currencies, gold, stocks and bonds." },
        item4: { title: "Market Makers", desc: "Match buyers and sellers and keep the market moving." },
        item5: { title: "The Economic Calendar", desc: "The key news that can increase volatility." },
        item6: { title: "Geopolitical Events", desc: "Wars, elections, sanctions and crises that shift market sentiment." },
        item7: { title: "Liquidity", desc: "The market's fuel. Without liquidity, the market doesn't move." },
        item8: { title: "Capital Flow", desc: "Money constantly moves between assets. Understanding the flow = an edge." },
        item9: { title: "Retail Traders", desc: "Millions of individual traders who contribute to liquidity." },
        item10: { title: "Algorithms (HFT & AI)", desc: "Execute trades in milliseconds and process massive amounts of data." },
        cta: "Understand the forces. Follow the market. Trade smart."
      }
    },
    calendar: { eyebrow: "Calendar", title: "Economic Calendar", desc: "Live economic events, updated in real time — powered by TradingView.",
      lesson: {
        head: "Heroes of the Economic Calendar", subhead: "The most important indicators that move the markets",
        item1: { title: "NFP", subtitle: "Non-Farm Payrolls", desc: "The number of new jobs created in the US, outside the agricultural sector. One of the most anticipated monthly indicators — it can strongly move the USD and stock markets.", nickname: "The King of Jobs" },
        item2: { title: "CPI", subtitle: "Consumer Price Index", desc: "Measures the change in consumer prices and indicates the level of inflation. A CPI higher than expected can push central banks to raise interest rates.", nickname: "The King of Inflation" },
        item3: { title: "Interest Rate", subtitle: "Interest Rate Decision", desc: "The official decision on the benchmark interest rate. It has a direct impact on currency value, borrowing costs and investors' appetite for risk.", nickname: "The Head of Central Banks" },
        item4: { title: "Powell Speech", subtitle: "The Fed Chair's Speech", desc: "Statements from the Federal Reserve chair can confirm or shift the market's expectations about monetary policy — and trigger sudden moves.", nickname: "The Voice That Moves Markets" },
        item5: { title: "GDP", subtitle: "Gross Domestic Product", desc: "The total value of goods and services produced in an economy. It shows whether the economy is growing or slowing, influencing investor confidence.", nickname: "The Power of the Economy" },
        item6: { title: "PMI", subtitle: "Purchasing Managers' Index", desc: "A monthly survey of purchasing managers, showing whether activity in industry and services is expanding or contracting.", nickname: "The Health of Industry" },
        item7: { title: "Retail Sales", subtitle: "Retail Sales", desc: "Measures consumer spending in stores. Strong spending supports economic growth; a decline can signal a slowdown.", nickname: "The Power of the Consumer" },
        item8: { title: "Unemployment Rate", subtitle: "Unemployment Rate", desc: "The percentage of the workforce actively looking for a job. Low unemployment signals a healthy economy, but can also fuel inflation.", nickname: "The Barometer of Jobs" },
        item9: { title: "PPI", subtitle: "Producer Price Index", desc: "Measures the change in prices at the producer level, often an early signal for the inflation that will later reach consumers (CPI).", nickname: "Inflation at the Source" },
        item10: { title: "FOMC Minutes", subtitle: "FOMC Meeting Minutes", desc: "The detailed minutes of the Federal Open Market Committee meeting, explaining the reasoning behind monetary policy decisions.", nickname: "Reading Between the Lines" },
        cta: "Every hero has the power to move the market. Follow them. Understand them. Profit from them."
      }
    },
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
    education: { eyebrow: "Обучение", title: "Основы трейдинга", desc: "Узнайте, как работает рынок, кто формирует ликвидность и как управлять риском.",
      lesson: {
        eyebrow: "🎓 Обучающий урок", title: "Кто формирует рынок Форекс?",
        intro: "Рынок Форекс — крупнейший финансовый рынок в мире, с ежедневным объёмом более 7 триллионов долларов. Движения валют не случайны. На них влияют четыре главные силы.",
        actorsHead: "4 главных участника рынка Форекс",
        examplesLabel: "Примеры:", impactLabel: "Влияние:",
        actor1: { title: "1. Центральные банки", subtitle: "Архитекторы мировой экономики", point1: "Контролируют денежно-кредитную политику.", point2: "Определяют ставку, ликвидность, инфляцию и стабильность валюты.", examples: "ФРС · Bank of England · Европейский центральный банк · Bank of Japan", impact: "Если центральный банк повышает ставку, валюта этой страны становится более привлекательной и укрепляется." },
        actor2: { title: "2. Инвестиционные банки", subtitle: "Двигатель ликвидности", point1: "Исполняют ордера на миллиарды долларов.", point2: "Обеспечивают ликвидность и создают рынки.", point3: "Торгуют в интересах клиентов и крупных институтов.", examples: "Goldman Sachs · JPMorgan Chase & Co. · Citi · UBS", impact: "Крупные ордера банков могут сильно двигать рынок и создавать новые зоны ликвидности." },
        actor3: { title: "3. Инвестиционные фонды", subtitle: "Капитал, который двигает рынки", point1: "Управляют миллиардами или триллионами долларов.", point2: "Цель: защита и рост капитала.", point3: "Покупают и продают исходя из стратегии и прогнозов.", examples: "BlackRock · Vanguard · Fidelity · Bridgewater", impact: "Крупные потоки капитала могут резко увеличивать или уменьшать спрос и предложение на рынке." },
        actor4: { title: "4. Геополитические события", subtitle: "Непредсказуемый фактор", point1: "Глобальные события меняют настроение рынка.", point2: "Войны, санкции, выборы, энергетические кризисы, пандемии, торговые соглашения и другое.", examples: "Войны · Выборы · Энергетические кризисы · Соглашения", impact: "Инвесторы ищут безопасность или возможности, а рынки реагируют быстро и резко." },
        flowTitle: "Как информация распространяется на рынке?",
        flowText: "Информация начинается с экономических событий и глобальных решений, обрабатывается крупными институтами и доходит до розничных трейдеров. Понимание этого потока помогает увидеть полную картину.",
        flow1: "Экономические события", flow2: "Центральные банки", flow3: "Инвестиционные банки", flow4: "Инвестиционные фонды", flow5: "Брокеры / Институты", flow6: "Розничные трейдеры",
        philosophyTitle: "Философия Treiding Satellite Broadcast",
        philosophyText: "Успешный трейдер не просто смотрит на графики. Он понимает, почему движется рынок. В Treiding Satellite Broadcast мы постоянно анализируем 4 силы, влияющие на рынок Форекс, и передаём эту информацию нашим участникам, чтобы вы принимали взвешенные решения и всегда были на шаг впереди.",
        badge1: "📈 Глубокий анализ", badge2: "🕐 Информация в реальном времени", badge3: "🌐 Глобальное видение", badge4: "🎯 Умные решения",
        disclaimer: "Торговля связана с риском. Прошлые результаты не гарантируют будущих. Информация на этом сайте носит образовательный характер и не является финансовой рекомендацией."
      },
      forces: {
        head: "10 реальных сил на рынке Форекс", subhead: "Кто двигает валютный рынок и почему это важно",
        item1: { title: "Центральные банки", desc: "Контролируют процентные ставки, ликвидность и экономику." },
        item2: { title: "Инвестиционные банки", desc: "Исполняют крупные ордера и обеспечивают ликвидность рынка." },
        item3: { title: "Инвестиционные фонды", desc: "Перемещают миллиарды долларов между валютами, золотом, акциями и облигациями." },
        item4: { title: "Маркет-мейкеры", desc: "Сводят покупателей и продавцов и поддерживают движение рынка." },
        item5: { title: "Экономический календарь", desc: "Важные новости, способные усилить волатильность." },
        item6: { title: "Геополитические события", desc: "Войны, выборы, санкции и кризисы, меняющие настроение рынка." },
        item7: { title: "Ликвидность", desc: "Топливо рынка. Без ликвидности рынок не двигается." },
        item8: { title: "Поток капитала", desc: "Деньги постоянно перемещаются между активами. Понимание потока = преимущество." },
        item9: { title: "Розничные трейдеры", desc: "Миллионы индивидуальных трейдеров, вносящих вклад в ликвидность." },
        item10: { title: "Алгоритмы (HFT и ИИ)", desc: "Исполняют сделки за миллисекунды и обрабатывают огромные объёмы данных." },
        cta: "Понимайте силы. Следите за рынком. Торгуйте разумно."
      }
    },
    calendar: { eyebrow: "Календарь", title: "Экономический календарь", desc: "Живые экономические события, обновляются в реальном времени — данные TradingView.",
      lesson: {
        head: "Герои экономического календаря", subhead: "Самые важные индикаторы, двигающие рынки",
        item1: { title: "NFP", subtitle: "Non-Farm Payrolls", desc: "Число новых рабочих мест, созданных в США вне сельского хозяйства. Один из самых ожидаемых ежемесячных показателей — способен сильно двигать USD и фондовые рынки.", nickname: "Король рабочих мест" },
        item2: { title: "CPI", subtitle: "Индекс потребительских цен", desc: "Измеряет изменение потребительских цен и указывает уровень инфляции. CPI выше ожиданий может подтолкнуть центральные банки к повышению ставок.", nickname: "Король инфляции" },
        item3: { title: "Interest Rate", subtitle: "Решение по ставке", desc: "Официальное решение по базовой процентной ставке. Напрямую влияет на стоимость валюты, стоимость кредитов и аппетит инвесторов к риску.", nickname: "Глава центральных банков" },
        item4: { title: "Powell Speech", subtitle: "Речь главы ФРС", desc: "Заявления главы ФРС США могут подтвердить или изменить ожидания рынка относительно денежно-кредитной политики — и вызвать резкие движения.", nickname: "Голос, двигающий рынки" },
        item5: { title: "GDP", subtitle: "Валовой внутренний продукт", desc: "Общая стоимость товаров и услуг, произведённых в экономике. Показывает, растёт экономика или замедляется, влияя на доверие инвесторов.", nickname: "Сила экономики" },
        item6: { title: "PMI", subtitle: "Индекс деловой активности", desc: "Ежемесячный опрос менеджеров по закупкам, показывающий, расширяется или сокращается активность в промышленности и услугах.", nickname: "Здоровье промышленности" },
        item7: { title: "Retail Sales", subtitle: "Розничные продажи", desc: "Измеряет расходы потребителей в магазинах. Сильные расходы поддерживают экономический рост; снижение может сигнализировать о замедлении.", nickname: "Сила потребителя" },
        item8: { title: "Unemployment Rate", subtitle: "Уровень безработицы", desc: "Процент трудоспособного населения, ищущего работу. Низкая безработица говорит о здоровой экономике, но может также разгонять инфляцию.", nickname: "Барометр рабочих мест" },
        item9: { title: "PPI", subtitle: "Индекс цен производителей", desc: "Измеряет изменение цен на уровне производителей — часто ранний сигнал инфляции, которая позже дойдёт до потребителей (CPI).", nickname: "Инфляция у источника" },
        item10: { title: "FOMC Minutes", subtitle: "Протокол заседания FOMC", desc: "Подробный протокол заседания Федерального комитета по открытым рынкам с объяснением причин решений по денежно-кредитной политике.", nickname: "Читать между строк" },
        cta: "Каждый герой способен двигать рынок. Следите за ними. Понимайте их. Извлекайте выгоду."
      }
    },
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
    education: { eyebrow: "Навчання", title: "Основи трейдингу", desc: "Дізнайтеся, як працює ринок, хто формує ліквідність і як керувати ризиком.",
      lesson: {
        eyebrow: "🎓 Навчальний урок", title: "Хто формує ринок Форекс?",
        intro: "Ринок Форекс — найбільший фінансовий ринок у світі, з щоденним обсягом понад 7 трильйонів доларів. Рухи валют не випадкові. На них впливають чотири головні сили.",
        actorsHead: "4 головні учасники ринку Форекс",
        examplesLabel: "Приклади:", impactLabel: "Вплив:",
        actor1: { title: "1. Центральні банки", subtitle: "Архітектори світової економіки", point1: "Контролюють монетарну політику.", point2: "Визначають ставку, ліквідність, інфляцію та стабільність валюти.", examples: "ФРС · Bank of England · Європейський центральний банк · Bank of Japan", impact: "Якщо центральний банк підвищує ставку, валюта цієї країни стає привабливішою та зміцнюється." },
        actor2: { title: "2. Інвестиційні банки", subtitle: "Двигун ліквідності", point1: "Виконують ордери на мільярди доларів.", point2: "Забезпечують ліквідність і створюють ринки.", point3: "Торгують в інтересах клієнтів і великих інституцій.", examples: "Goldman Sachs · JPMorgan Chase & Co. · Citi · UBS", impact: "Великі ордери банків можуть сильно рухати ринок і створювати нові зони ліквідності." },
        actor3: { title: "3. Інвестиційні фонди", subtitle: "Капітал, що рухає ринки", point1: "Керують мільярдами або трильйонами доларів.", point2: "Мета: захист і зростання капіталу.", point3: "Купують і продають виходячи зі стратегії та прогнозів.", examples: "BlackRock · Vanguard · Fidelity · Bridgewater", impact: "Великі потоки капіталу можуть різко збільшувати або зменшувати попит і пропозицію на ринку." },
        actor4: { title: "4. Геополітичні події", subtitle: "Непередбачуваний фактор", point1: "Глобальні події змінюють настрій ринку.", point2: "Війни, санкції, вибори, енергетичні кризи, пандемії, торговельні угоди та інше.", examples: "Війни · Вибори · Енергетичні кризи · Угоди", impact: "Інвестори шукають безпеку або можливості, а ринки реагують швидко і різко." },
        flowTitle: "Як інформація поширюється на ринку?",
        flowText: "Інформація починається з економічних подій і глобальних рішень, обробляється великими інституціями і доходить до роздрібних трейдерів. Розуміння цього потоку допомагає побачити повну картину.",
        flow1: "Економічні події", flow2: "Центральні банки", flow3: "Інвестиційні банки", flow4: "Інвестиційні фонди", flow5: "Брокери / Інституції", flow6: "Роздрібні трейдери",
        philosophyTitle: "Філософія Treiding Satellite Broadcast",
        philosophyText: "Успішний трейдер не просто дивиться на графіки. Він розуміє, чому рухається ринок. У Treiding Satellite Broadcast ми постійно аналізуємо 4 сили, що впливають на ринок Форекс, і передаємо цю інформацію нашим учасникам, щоб ви ухвалювали зважені рішення і завжди були на крок попереду.",
        badge1: "📈 Глибокий аналіз", badge2: "🕐 Інформація в реальному часі", badge3: "🌐 Глобальне бачення", badge4: "🎯 Розумні рішення",
        disclaimer: "Торгівля пов'язана з ризиком. Минулі результати не гарантують майбутніх. Інформація на цьому сайті має освітній характер і не є фінансовою рекомендацією."
      },
      forces: {
        head: "10 реальних сил на ринку Форекс", subhead: "Хто рухає валютний ринок і чому це важливо",
        item1: { title: "Центральні банки", desc: "Контролюють процентні ставки, ліквідність та економіку." },
        item2: { title: "Інвестиційні банки", desc: "Виконують великі ордери та забезпечують ліквідність ринку." },
        item3: { title: "Інвестиційні фонди", desc: "Переміщують мільярди доларів між валютами, золотом, акціями та облігаціями." },
        item4: { title: "Маркет-мейкери", desc: "Зводять покупців і продавців та підтримують рух ринку." },
        item5: { title: "Економічний календар", desc: "Важливі новини, здатні посилити волатильність." },
        item6: { title: "Геополітичні події", desc: "Війни, вибори, санкції та кризи, що змінюють настрій ринку." },
        item7: { title: "Ліквідність", desc: "Паливо ринку. Без ліквідності ринок не рухається." },
        item8: { title: "Потік капіталу", desc: "Гроші постійно переміщуються між активами. Розуміння потоку = перевага." },
        item9: { title: "Роздрібні трейдери", desc: "Мільйони індивідуальних трейдерів, що вносять внесок у ліквідність." },
        item10: { title: "Алгоритми (HFT та ШІ)", desc: "Виконують угоди за мілісекунди та обробляють величезні обсяги даних." },
        cta: "Розумійте сили. Слідкуйте за ринком. Торгуйте розумно."
      }
    },
    calendar: { eyebrow: "Календар", title: "Економічний календар", desc: "Живі економічні події, оновлюються в реальному часі — дані TradingView.",
      lesson: {
        head: "Герої економічного календаря", subhead: "Найважливіші індикатори, що рухають ринки",
        item1: { title: "NFP", subtitle: "Non-Farm Payrolls", desc: "Кількість нових робочих місць, створених у США поза сільським господарством. Один із найочікуваніших щомісячних показників — здатний сильно рухати USD і фондові ринки.", nickname: "Король робочих місць" },
        item2: { title: "CPI", subtitle: "Індекс споживчих цін", desc: "Вимірює зміну споживчих цін і вказує рівень інфляції. CPI вищий за очікування може підштовхнути центральні банки до підвищення ставок.", nickname: "Король інфляції" },
        item3: { title: "Interest Rate", subtitle: "Рішення щодо ставки", desc: "Офіційне рішення щодо базової процентної ставки. Безпосередньо впливає на вартість валюти, вартість кредитів і апетит інвесторів до ризику.", nickname: "Голова центральних банків" },
        item4: { title: "Powell Speech", subtitle: "Промова голови ФРС", desc: "Заяви голови ФРС США можуть підтвердити або змінити очікування ринку щодо монетарної політики — і викликати різкі рухи.", nickname: "Голос, що рухає ринки" },
        item5: { title: "GDP", subtitle: "Валовий внутрішній продукт", desc: "Загальна вартість товарів і послуг, вироблених в економіці. Показує, чи зростає економіка, чи сповільнюється, впливаючи на довіру інвесторів.", nickname: "Сила економіки" },
        item6: { title: "PMI", subtitle: "Індекс ділової активності", desc: "Щомісячне опитування менеджерів із закупівель, яке показує, чи розширюється, чи скорочується активність у промисловості та послугах.", nickname: "Здоров'я промисловості" },
        item7: { title: "Retail Sales", subtitle: "Роздрібні продажі", desc: "Вимірює витрати споживачів у магазинах. Сильні витрати підтримують економічне зростання; зниження може сигналізувати про уповільнення.", nickname: "Сила споживача" },
        item8: { title: "Unemployment Rate", subtitle: "Рівень безробіття", desc: "Відсоток працездатного населення, яке шукає роботу. Низьке безробіття свідчить про здорову економіку, але може також розганяти інфляцію.", nickname: "Барометр робочих місць" },
        item9: { title: "PPI", subtitle: "Індекс цін виробників", desc: "Вимірює зміну цін на рівні виробників — часто ранній сигнал інфляції, яка згодом дійде до споживачів (CPI).", nickname: "Інфляція у джерела" },
        item10: { title: "FOMC Minutes", subtitle: "Протокол засідання FOMC", desc: "Детальний протокол засідання Федерального комітету з відкритого ринку з поясненням причин рішень щодо монетарної політики.", nickname: "Читати між рядків" },
        cta: "Кожен герой здатен рухати ринок. Слідкуйте за ними. Розумійте їх. Отримуйте вигоду."
      }
    },
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
    education: { eyebrow: "Edukacja", title: "Podstawy tradingu", desc: "Dowiedz się, jak działa rynek, kto tworzy płynność i jak zarządzać ryzykiem.",
      lesson: {
        eyebrow: "🎓 Lekcja edukacyjna", title: "Kto tworzy rynek Forex?",
        intro: "Rynek Forex to największy rynek finansowy na świecie, z dziennym wolumenem przekraczającym 7 bilionów USD. Ruchy walut nie są przypadkowe. Wpływają na nie cztery główne siły.",
        actorsHead: "4 główni gracze rynku Forex",
        examplesLabel: "Przykłady:", impactLabel: "Wpływ:",
        actor1: { title: "1. Banki centralne", subtitle: "Architekci światowej gospodarki", point1: "Kontrolują politykę monetarną.", point2: "Decydują o stopach procentowych, płynności, inflacji i stabilności waluty.", examples: "FED · Bank of England · Europejski Bank Centralny · Bank of Japan", impact: "Jeśli bank centralny podnosi stopy procentowe, waluta tego kraju staje się bardziej atrakcyjna i zyskuje na wartości." },
        actor2: { title: "2. Banki inwestycyjne", subtitle: "Silnik płynności", point1: "Realizują zlecenia warte miliardy dolarów.", point2: "Zapewniają płynność i tworzą rynki.", point3: "Handlują w imieniu klientów i dużych instytucji.", examples: "Goldman Sachs · JPMorgan Chase & Co. · Citi · UBS", impact: "Duże zlecenia realizowane przez banki mogą mocno poruszyć rynek i tworzyć nowe strefy płynności." },
        actor3: { title: "3. Fundusze inwestycyjne", subtitle: "Kapitał, który porusza rynki", point1: "Zarządzają miliardami lub bilionami dolarów.", point2: "Cel: ochrona i wzrost kapitału.", point3: "Kupują i sprzedają w zależności od strategii i perspektyw.", examples: "BlackRock · Vanguard · Fidelity · Bridgewater", impact: "Duże przepływy kapitału mogą gwałtownie zwiększać lub zmniejszać popyt i podaż na rynku." },
        actor4: { title: "4. Wydarzenia geopolityczne", subtitle: "Nieprzewidywalny czynnik", point1: "Globalne wydarzenia zmieniają nastroje rynkowe.", point2: "Wojny, sankcje, wybory, kryzysy energetyczne, pandemie, umowy handlowe i inne.", examples: "Wojny · Wybory · Kryzysy energetyczne · Umowy", impact: "Inwestorzy szukają bezpieczeństwa lub okazji, a rynki reagują szybko i gwałtownie." },
        flowTitle: "Jak informacja przepływa przez rynek?",
        flowText: "Informacja zaczyna się od wydarzeń gospodarczych i globalnych decyzji, jest przetwarzana przez duże instytucje i dociera do traderów detalicznych. Zrozumienie tego przepływu pomaga zobaczyć pełny obraz.",
        flow1: "Wydarzenia gospodarcze", flow2: "Banki centralne", flow3: "Banki inwestycyjne", flow4: "Fundusze inwestycyjne", flow5: "Brokerzy / Instytucje", flow6: "Traderzy detaliczni",
        philosophyTitle: "Filozofia Treiding Satellite Broadcast",
        philosophyText: "Skuteczny trader nie patrzy tylko na wykresy. Rozumie, dlaczego rynek się porusza. W Treiding Satellite Broadcast stale analizujemy 4 siły wpływające na rynek Forex i przekazujemy te informacje naszym członkom, abyś mógł podejmować świadome decyzje i zawsze być o krok do przodu.",
        badge1: "📈 Dogłębna analiza", badge2: "🕐 Informacje w czasie rzeczywistym", badge3: "🌐 Globalna wizja", badge4: "🎯 Inteligentne decyzje",
        disclaimer: "Trading wiąże się z ryzykiem. Wyniki historyczne nie gwarantują przyszłych rezultatów. Informacje na tej stronie mają charakter edukacyjny i nie stanowią porady finansowej."
      },
      forces: {
        head: "10 Realnych Sił na Rynku Forex", subhead: "Kto porusza rynkiem walutowym i dlaczego to ważne",
        item1: { title: "Banki Centralne", desc: "Kontrolują stopy procentowe, płynność i gospodarkę." },
        item2: { title: "Banki Inwestycyjne", desc: "Realizują duże zlecenia i zapewniają płynność rynku." },
        item3: { title: "Fundusze Inwestycyjne", desc: "Przenoszą miliardy dolarów między walutami, złotem, akcjami i obligacjami." },
        item4: { title: "Market Makerzy", desc: "Łączą kupujących i sprzedających oraz utrzymują ruch na rynku." },
        item5: { title: "Kalendarz Ekonomiczny", desc: "Ważne wiadomości, które mogą zwiększyć zmienność." },
        item6: { title: "Wydarzenia Geopolityczne", desc: "Wojny, wybory, sankcje i kryzysy zmieniające nastroje rynkowe." },
        item7: { title: "Płynność", desc: "Paliwo rynku. Bez płynności rynek się nie porusza." },
        item8: { title: "Przepływ Kapitału", desc: "Pieniądze wciąż przemieszczają się między aktywami. Zrozumienie przepływu = przewaga." },
        item9: { title: "Traderzy Detaliczni", desc: "Miliony indywidualnych traderów, którzy przyczyniają się do płynności." },
        item10: { title: "Algorytmy (HFT i AI)", desc: "Realizują transakcje w milisekundach i przetwarzają ogromne ilości danych." },
        cta: "Zrozum siły. Obserwuj rynek. Handluj mądrze."
      }
    },
    calendar: { eyebrow: "Kalendarz", title: "Kalendarz ekonomiczny", desc: "Wydarzenia gospodarcze na żywo, aktualizowane w czasie rzeczywistym — dane TradingView.",
      lesson: {
        head: "Bohaterowie Kalendarza Ekonomicznego", subhead: "Najważniejsze wskaźniki poruszające rynkami",
        item1: { title: "NFP", subtitle: "Non-Farm Payrolls", desc: "Liczba nowych miejsc pracy utworzonych w USA poza sektorem rolniczym. Jeden z najbardziej oczekiwanych wskaźników miesięcznych — może mocno poruszyć USD i rynki akcji.", nickname: "Król miejsc pracy" },
        item2: { title: "CPI", subtitle: "Consumer Price Index", desc: "Mierzy zmianę cen konsumpcyjnych i wskazuje poziom inflacji. CPI wyższy od oczekiwań może skłonić banki centralne do podwyżki stóp procentowych.", nickname: "Król inflacji" },
        item3: { title: "Interest Rate", subtitle: "Decyzja o stopach procentowych", desc: "Oficjalna decyzja w sprawie referencyjnej stopy procentowej. Ma bezpośredni wpływ na wartość waluty, koszt kredytów i apetyt inwestorów na ryzyko.", nickname: "Szef banków centralnych" },
        item4: { title: "Powell Speech", subtitle: "Przemówienie szefa Fed", desc: "Wypowiedzi szefa Rezerwy Federalnej USA mogą potwierdzić lub zmienić oczekiwania rynku dotyczące polityki monetarnej — i wywołać gwałtowne ruchy.", nickname: "Głos, który porusza rynkami" },
        item5: { title: "GDP", subtitle: "Produkt Krajowy Brutto", desc: "Całkowita wartość dóbr i usług wytworzonych w gospodarce. Pokazuje, czy gospodarka rośnie, czy zwalnia, wpływając na zaufanie inwestorów.", nickname: "Siła gospodarki" },
        item6: { title: "PMI", subtitle: "Purchasing Managers' Index", desc: "Comiesięczna ankieta wśród menedżerów ds. zakupów, pokazująca, czy aktywność w przemyśle i usługach się rozszerza, czy kurczy.", nickname: "Zdrowie przemysłu" },
        item7: { title: "Retail Sales", subtitle: "Sprzedaż detaliczna", desc: "Mierzy wydatki konsumentów w sklepach. Silne wydatki wspierają wzrost gospodarczy; spadek może sygnalizować spowolnienie.", nickname: "Siła konsumenta" },
        item8: { title: "Unemployment Rate", subtitle: "Stopa bezrobocia", desc: "Odsetek osób zdolnych do pracy poszukujących zatrudnienia. Niskie bezrobocie wskazuje na zdrową gospodarkę, ale może też napędzać inflację.", nickname: "Barometr miejsc pracy" },
        item9: { title: "PPI", subtitle: "Producer Price Index", desc: "Mierzy zmianę cen na poziomie producentów — często wczesny sygnał inflacji, która później dotrze do konsumentów (CPI).", nickname: "Inflacja u źródła" },
        item10: { title: "FOMC Minutes", subtitle: "Protokół posiedzenia FOMC", desc: "Szczegółowy protokół posiedzenia Federalnego Komitetu Otwartego Rynku, wyjaśniający przyczyny decyzji dotyczących polityki monetarnej.", nickname: "Czytanie między wierszami" },
        cta: "Każdy bohater ma moc poruszania rynkiem. Obserwuj ich. Zrozum ich. Zyskaj na nich."
      }
    },
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
  loadEconomicCalendarWidget(lang);
}

/* ===================== Calendar economic live (TradingView) ===================== */
/* TradingView nu are localizare ro/uk; pentru aceste limbi widgetul ruleaza in engleza. */
const TV_CALENDAR_LOCALE_MAP = { ro: "en", en: "en", ru: "ru", uk: "en", pl: "pl" };
let tvCalendarLoadedLocale = null;

function loadEconomicCalendarWidget(lang) {
  const locale = TV_CALENDAR_LOCALE_MAP[lang] || "en";
  if (locale === tvCalendarLoadedLocale) return;
  const container = document.getElementById("tvEconomicCalendar");
  if (!container) return;

  container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  script.async = true;
  script.text = JSON.stringify({
    colorTheme: "dark",
    isTransparent: true,
    locale: locale,
    countryFilter: "us,eu,gb,de,fr,it,es,ru,cn,jp,ca,au,ch,pl,ua",
    importanceFilter: "-1,0,1",
    width: "100%",
    height: 520
  });
  container.appendChild(script);
  tvCalendarLoadedLocale = locale;
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
  const memberBtn = document.getElementById("memberButton");
  if (memberBtn) memberBtn.classList.add("is-member");
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
    .catch(() => {
      try { localStorage.removeItem(IDEAS_TOKEN_KEY); } catch (e) { /* ignore storage errors */ }
    });
})();

const ideasGateForm = document.getElementById("ideasGateForm");
if (ideasGateForm) {
  const passwordInput = document.getElementById("ideasGatePassword");
  const gateButton = document.getElementById("ideasGateButton");
  const gateMessage = document.getElementById("ideasGateMessage");
  const gateButtonDefaultText = gateButton.textContent;

  ideasGateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dict = translations[currentLang] || translations.ro;
    const password = (passwordInput.value || "").trim();

    gateMessage.classList.remove("is-error", "is-success");

    if (!password) {
      gateMessage.textContent = getNested(dict, "ideas.gate.invalid") || "Incorrect password.";
      gateMessage.classList.add("is-error");
      return;
    }

    gateButton.disabled = true;
    gateButton.textContent = getNested(dict, "ideas.gate.sending") || "...";
    gateMessage.textContent = "";

    try {
      const response = await fetch("/api/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      let data = {};
      try { data = await response.json(); } catch (parseErr) { /* non-JSON response */ }

      if (!response.ok || !data.success || !data.token) {
        throw new Error((data && data.error) || "Request failed");
      }

      try { localStorage.setItem(IDEAS_TOKEN_KEY, data.token); } catch (storageErr) { /* ignore storage errors */ }

      const ideas = await fetchIdeasWithToken(data.token);
      unlockIdeas(ideas);
      passwordInput.value = "";
    } catch (err) {
      gateMessage.textContent = getNested(dict, "ideas.gate.invalid") || "Incorrect password.";
      gateMessage.classList.add("is-error");
    } finally {
      gateButton.disabled = false;
      gateButton.textContent = getNested(dict, "ideas.gate.button") || gateButtonDefaultText;
    }
  });
}

/* ===================== Ultimul raport PDF (din treidingsb-reports) ===================== */
const REPORTS_REPO_API = "https://api.github.com/repos/sergiuburlea37-star/treidingsb-reports/contents/reports";
let latestReportInfo = null;

// Limbile in care se pot genera rapoartele PDF (trebuie sa corespunda cu
// sufixele de fisier produse de treidingsb-reports/scripts/generate_report.py)
const REPORT_LANGS = ["ro", "en", "ru", "uk", "pl"];

function pickReportUrl(urls) {
  if (!urls) return null;
  if (urls[currentLang]) return urls[currentLang];
  if (urls.ro) return urls.ro;
  const firstKey = Object.keys(urls)[0];
  return firstKey ? urls[firstKey] : null;
}

function renderReportStatus() {
  const statusEl = document.getElementById("reportStatus");
  const linkEl = document.getElementById("reportDownloadLink");
  if (!statusEl || !latestReportInfo) return;
  const dict = translations[currentLang] || translations.ro;
  const url = pickReportUrl(latestReportInfo.urls);
  statusEl.textContent = (getNested(dict, "reports.latestLabel") || "Latest report:") + " " + latestReportInfo.dateStr;
  statusEl.classList.remove("is-error");
  statusEl.classList.add("is-ready");
  if (linkEl && url) {
    linkEl.href = url;
    linkEl.classList.remove("is-loading");
  }
}

async function loadLatestReport() {
  const statusEl = document.getElementById("reportStatus");
  try {
    const quarterRes = await fetch(REPORTS_REPO_API);
    if (!quarterRes.ok) throw new Error("quarters fetch failed");
    const quarters = await quarterRes.json();
    const quarterDirs = (Array.isArray(quarters) ? quarters : []).filter(
      (it) => it.type === "dir" && /^Q[1-4]_\d{4}$/.test(it.name)
    );
    if (!quarterDirs.length) throw new Error("no quarters");

    quarterDirs.sort((a, b) => {
      const ma = a.name.match(/^Q([1-4])_(\d{4})$/);
      const mb = b.name.match(/^Q([1-4])_(\d{4})$/);
      if (mb[2] !== ma[2]) return Number(mb[2]) - Number(ma[2]);
      return Number(mb[1]) - Number(ma[1]);
    });
    const latestQuarter = quarterDirs[0].name;

    const filesRes = await fetch(`${REPORTS_REPO_API}/${latestQuarter}`);
    if (!filesRes.ok) throw new Error("files fetch failed");
    const files = await filesRes.json();

    // Fisiere noi, cu limba in nume: raport-2026-07-13-en.pdf
    // Fisiere vechi, fara limba (dinainte de suport multilingv): raport-2026-07-13.pdf -> tratate ca "ro"
    const langPattern = /^raport-(\d{4}-\d{2}-\d{2})-(ro|en|ru|uk|pl)\.pdf$/;
    const legacyPattern = /^raport-(\d{4}-\d{2}-\d{2})\.pdf$/;

    const byDate = {};
    (Array.isArray(files) ? files : []).forEach((it) => {
      if (it.type !== "file") return;
      let date = null;
      let lang = null;
      const langMatch = it.name.match(langPattern);
      if (langMatch) {
        date = langMatch[1];
        lang = langMatch[2];
      } else {
        const legacyMatch = it.name.match(legacyPattern);
        if (legacyMatch) {
          date = legacyMatch[1];
          lang = "ro";
        }
      }
      if (!date || !lang) return;
      if (!byDate[date]) byDate[date] = {};
      byDate[date][lang] = it.download_url;
    });

    const dates = Object.keys(byDate).sort().reverse();
    if (!dates.length) throw new Error("no report files");
    const latestDate = dates[0];
    const [y, m, d] = latestDate.split("-");
    const dateStr = `${d}.${m}.${y}`;

    latestReportInfo = { urls: byDate[latestDate], dateStr };
    renderReportStatus();
  } catch (err) {
    if (statusEl) {
      const dict = translations[currentLang] || translations.ro;
      statusEl.textContent = getNested(dict, "reports.unavailable") || "No report available yet.";
      statusEl.classList.remove("is-ready");
      statusEl.classList.add("is-error");
    }
    const linkEl = document.getElementById("reportDownloadLink");
    if (linkEl) linkEl.classList.remove("is-loading");
  }
}

applyLanguage(detectInitialLang());
