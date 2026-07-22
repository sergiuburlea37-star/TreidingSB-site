// api/lib/personalize-report.js
// Personalizeaza un raport PDF pentru un abonat: adauga pagina de licenta
// personala, watermark pe fiecare pagina, footer cu identificatori, pagina
// finala de copyright/declaratie legala si metadate ascunse in fisier.
//
// Politica: raportul NU este niciodata trimis fara aceste elemente. Daca
// personalizarea esueaza dintr-un motiv tehnic, apelantul (send-email.js)
// decide fallback-ul (best-effort), dar aceasta functie insasi nu produce
// niciodata o "copie anonima" — primeste intotdeauna un email de abonat.

import crypto from 'crypto';
import { PDFDocument, rgb, degrees, PDFName, PDFString } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_REGULAR_URL = 'https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/assets/fonts/DejaVuSans.ttf';
const FONT_BOLD_URL = 'https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/assets/fonts/DejaVuSans-Bold.ttf';

const PAGE_SIZE = [595.28, 841.89]; // A4

const MONTHS = {
  ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
};

const LEGAL = {
  ro: {
    licensedTo: 'Licențiat exclusiv pentru:',
    memberIdLabel: 'ID Membru:',
    personalLicenseTitle: 'LICENȚĂ PERSONALĂ',
    personalLicenseBody: [
      'Acest raport a fost emis exclusiv pentru abonatul înregistrat.',
      '',
      'Redistribuirea, revânzarea, publicarea pe site-uri web, rețele sociale, ' +
        'Telegram, Discord, sau orice utilizare comercială este strict interzisă.',
      '',
      'Încălcarea acestor termeni poate duce la închiderea imediată a contului, ' +
        'fără rambursare, și acțiuni legale.'
    ],
    watermarkLine1: 'TreidingSB — Licențiat pentru:',
    watermarkLine3: 'Uz personal exclusiv',
    footerGeneratedFor: 'Generat pentru:',
    footerDate: 'Data generării:',
    footerDocId: 'ID Document:',
    copyrightTitle: '© 2026 TreidingSB. Toate drepturile rezervate.',
    copyrightBody: [
      'Acest raport este protejat de legislația internațională privind drepturile de autor.',
      'Copierea, redistribuirea, revânzarea sau utilizarea comercială neautorizată este strict interzisă.'
    ],
    legalDeclTitle: 'DECLARAȚIE LEGALĂ',
    legalDeclBody: [
      'Acest raport este proprietate intelectuală a TreidingSB.',
      'Abonatul primește o licență personală, netransferabilă, de acces la acest material.',
      '',
      'Dreptul de proprietate asupra raportului rămâne exclusiv al TreidingSB.',
      'Niciun drept de proprietate nu este transferat abonatului.'
    ],
    professionalPara: 'Rapoartele TreidingSB sunt licențiate exclusiv pentru abonatul înregistrat. ' +
      'Fiecare raport conține identificatori unici și marcaje de securitate care permit urmărirea ' +
      'distribuirii neautorizate. Prin accesarea acestui raport, abonatul este de acord că orice ' +
      'copiere, redistribuire, publicare, revânzare sau utilizare comercială neautorizată constituie ' +
      'o încălcare a acordului de licență și poate duce la închiderea imediată a contului și acțiuni ' +
      'legale, acolo unde legea aplicabilă permite.',
    reportLabel: 'Raport:',
    memberLabel: 'Membru:',
    hashLabel: 'Hash:',
    generatedLabel: 'Generat:'
  },
  en: {
    licensedTo: 'Licensed exclusively to:',
    memberIdLabel: 'Member ID:',
    personalLicenseTitle: 'PERSONAL LICENSE',
    personalLicenseBody: [
      'This report has been issued exclusively for the registered subscriber.',
      '',
      'Redistribution, resale, publication on websites, social media, ' +
        'Telegram, Discord, or any commercial use is strictly prohibited.',
      '',
      'Violation of these terms may result in immediate account termination, ' +
        'without refund, and legal action.'
    ],
    watermarkLine1: 'TreidingSB — Licensed to:',
    watermarkLine3: 'Personal Use Only',
    footerGeneratedFor: 'Generated for:',
    footerDate: 'Generation Date:',
    footerDocId: 'Document ID:',
    copyrightTitle: '© 2026 TreidingSB. All Rights Reserved.',
    copyrightBody: [
      'This report is protected by international copyright laws.',
      'Unauthorized copying, redistribution, resale or commercial use is strictly prohibited.'
    ],
    legalDeclTitle: 'LEGAL DECLARATION',
    legalDeclBody: [
      'This report is intellectual property of TreidingSB.',
      'The subscriber receives a personal, non-transferable license to access this material.',
      '',
      'Ownership of the report remains exclusively with TreidingSB.',
      'No ownership rights are transferred to the subscriber.'
    ],
    professionalPara: 'TreidingSB reports are licensed exclusively to the registered subscriber. ' +
      'Each report contains unique identifiers and security markers that allow unauthorized ' +
      'distribution to be traced. By accessing this report, the subscriber agrees that any ' +
      'unauthorized copying, redistribution, publication, resale, or commercial use constitutes a ' +
      'violation of the license agreement and may result in immediate account termination and legal ' +
      'action where permitted by applicable law.',
    reportLabel: 'Report:',
    memberLabel: 'Member:',
    hashLabel: 'Hash:',
    generatedLabel: 'Generated:'
  },
  ru: {
    licensedTo: 'Лицензировано исключительно для:',
    memberIdLabel: 'ID участника:',
    personalLicenseTitle: 'ПЕРСОНАЛЬНАЯ ЛИЦЕНЗИЯ',
    personalLicenseBody: [
      'Данный отчёт выпущен исключительно для зарегистрированного подписчика.',
      '',
      'Распространение, перепродажа, публикация на веб-сайтах, в социальных сетях, ' +
        'Telegram, Discord, или любое коммерческое использование строго запрещены.',
      '',
      'Нарушение данных условий может привести к немедленному прекращению действия ' +
        'аккаунта без возврата средств и судебному преследованию.'
    ],
    watermarkLine1: 'TreidingSB — Лицензировано для:',
    watermarkLine3: 'Только для личного использования',
    footerGeneratedFor: 'Создано для:',
    footerDate: 'Дата создания:',
    footerDocId: 'ID документа:',
    copyrightTitle: '© 2026 TreidingSB. Все права защищены.',
    copyrightBody: [
      'Данный отчёт защищён международным законодательством об авторском праве.',
      'Несанкционированное копирование, распространение, перепродажа или коммерческое использование строго запрещены.'
    ],
    legalDeclTitle: 'ЮРИДИЧЕСКОЕ ЗАЯВЛЕНИЕ',
    legalDeclBody: [
      'Данный отчёт является интеллектуальной собственностью TreidingSB.',
      'Подписчик получает персональную, непередаваемую лицензию на доступ к данному материалу.',
      '',
      'Право собственности на отчёт остаётся исключительно за TreidingSB.',
      'Никакие права собственности не передаются подписчику.'
    ],
    professionalPara: 'Отчёты TreidingSB лицензируются исключительно для зарегистрированного подписчика. ' +
      'Каждый отчёт содержит уникальные идентификаторы и защитные маркеры, позволяющие отследить ' +
      'несанкционированное распространение. Получая доступ к этому отчёту, подписчик соглашается с ' +
      'тем, что любое несанкционированное копирование, распространение, публикация, перепродажа или ' +
      'коммерческое использование является нарушением лицензионного соглашения и может повлечь ' +
      'немедленное прекращение действия аккаунта и судебные меры в рамках применимого законодательства.',
    reportLabel: 'Отчёт:',
    memberLabel: 'Участник:',
    hashLabel: 'Хэш:',
    generatedLabel: 'Создано:'
  },
  pl: {
    licensedTo: 'Licencja wyłącznie dla:',
    memberIdLabel: 'ID członka:',
    personalLicenseTitle: 'LICENCJA OSOBISTA',
    personalLicenseBody: [
      'Niniejszy raport został wydany wyłącznie dla zarejestrowanego subskrybenta.',
      '',
      'Redystrybucja, odsprzedaż, publikacja na stronach internetowych, w mediach ' +
        'społecznościowych, na Telegramie, Discordzie lub jakiekolwiek wykorzystanie komercyjne ' +
        'jest surowo zabronione.',
      '',
      'Naruszenie tych warunków może skutkować natychmiastowym zamknięciem konta, ' +
        'bez zwrotu kosztów, oraz działaniami prawnymi.'
    ],
    watermarkLine1: 'TreidingSB — Licencja dla:',
    watermarkLine3: 'Wyłącznie do użytku osobistego',
    footerGeneratedFor: 'Wygenerowano dla:',
    footerDate: 'Data wygenerowania:',
    footerDocId: 'ID dokumentu:',
    copyrightTitle: '© 2026 TreidingSB. Wszelkie prawa zastrzeżone.',
    copyrightBody: [
      'Niniejszy raport jest chroniony międzynarodowym prawem autorskim.',
      'Nieautoryzowane kopiowanie, redystrybucja, odsprzedaż lub wykorzystanie komercyjne jest surowo zabronione.'
    ],
    legalDeclTitle: 'OŚWIADCZENIE PRAWNE',
    legalDeclBody: [
      'Niniejszy raport jest własnością intelektualną TreidingSB.',
      'Subskrybent otrzymuje osobistą, niezbywalną licencję na dostęp do tego materiału.',
      '',
      'Prawo własności do raportu pozostaje wyłącznie po stronie TreidingSB.',
      'Żadne prawa własności nie są przenoszone na subskrybenta.'
    ],
    professionalPara: 'Raporty TreidingSB są licencjonowane wyłącznie dla zarejestrowanego subskrybenta. ' +
      'Każdy raport zawiera unikalne identyfikatory i znaczniki zabezpieczające, które umożliwiają ' +
      'śledzenie nieautoryzowanej dystrybucji. Uzyskując dostęp do tego raportu, subskrybent zgadza ' +
      'się, że jakiekolwiek nieautoryzowane kopiowanie, redystrybucja, publikacja, odsprzedaż lub ' +
      'wykorzystanie komercyjne stanowi naruszenie umowy licencyjnej i może skutkować natychmiastowym ' +
      'zamknięciem konta oraz działaniami prawnymi w zakresie dozwolonym przez obowiązujące prawo.',
    reportLabel: 'Raport:',
    memberLabel: 'Członek:',
    hashLabel: 'Hash:',
    generatedLabel: 'Wygenerowano:'
  }
};

function formatDate(dateStr, lang) {
  const months = MONTHS[lang] || MONTHS.en;
  const parts = (dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr || '';
  const [y, m, d] = parts;
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

function deriveMemberId(email) {
  const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return 'M-' + hash.slice(0, 6).toUpperCase();
}

function deriveReportNumber(email, reportDate, timestamp) {
  const hash = crypto.createHash('sha256').update(email + '|' + reportDate + '|' + timestamp).digest('hex');
  return `TSB-${reportDate}-${hash.slice(0, 6).toUpperCase()}`;
}

function deriveHashId(email, reportDate, timestamp) {
  const hash = crypto.createHash('sha256').update(email + '|' + reportDate + '|' + timestamp + '|hash').digest('hex').toUpperCase();
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCentered(page, text, font, size, y, color) {
  const width = font.widthOfTextAtSize(text, size);
  const pageWidth = page.getWidth();
  page.drawText(text, { x: (pageWidth - width) / 2, y, size, font, color });
}

function drawWatermark(page, font, t, email) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const size = 12;
  const color = rgb(0.55, 0.55, 0.55);
  const opacity = 0.13;
  const lines = [t.watermarkLine1, email, t.watermarkLine3];
  const fracs = [0.22, 0.5, 0.78];

  fracs.forEach((frac) => {
    const baseX = pageWidth * 0.18;
    const baseY = pageHeight * frac;
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: baseX,
        y: baseY - i * (size + 5),
        size,
        font,
        color,
        opacity,
        rotate: degrees(35)
      });
    });
  });
}

function drawFooter(page, font, t, email, dateDisplay, reportNumber) {
  const size = 6.5;
  const color = rgb(0.45, 0.45, 0.45);
  const margin = 16;
  const lines = [
    `${t.footerGeneratedFor} ${email}`,
    `${t.footerDate} ${dateDisplay}`,
    `${t.footerDocId} ${reportNumber}`
  ];
  let y = margin + (lines.length - 1) * (size + 2);
  lines.forEach((line) => {
    page.drawText(line, { x: margin, y, size, font, color, opacity: 0.75 });
    y -= (size + 2);
  });
}

function setHiddenMetadata(pdfDoc, meta) {
  pdfDoc.setTitle(`TreidingSB Report ${meta.reportNumber}`);
  pdfDoc.setAuthor('TreidingSB');
  pdfDoc.setSubject('Personal licensed report - TreidingSB');
  pdfDoc.setProducer('TreidingSB Platform');
  pdfDoc.setCreator('TreidingSB Platform');
  pdfDoc.setKeywords([
    `UserEmail:${meta.email}`,
    `MemberID:${meta.memberId}`,
    `ReportID:${meta.reportNumber}`,
    `GeneratedAt:${meta.generatedAt}`,
    'Platform:TreidingSB'
  ]);

  try {
    const infoRef = pdfDoc.context.trailerInfo.Info;
    if (infoRef) {
      const infoDict = pdfDoc.context.lookup(infoRef);
      if (infoDict && typeof infoDict.set === 'function') {
        infoDict.set(PDFName.of('TSB_UserEmail'), PDFString.of(meta.email));
        infoDict.set(PDFName.of('TSB_MemberID'), PDFString.of(meta.memberId));
        infoDict.set(PDFName.of('TSB_ReportID'), PDFString.of(meta.reportNumber));
        infoDict.set(PDFName.of('TSB_HashID'), PDFString.of(meta.hashId));
        infoDict.set(PDFName.of('TSB_GeneratedAt'), PDFString.of(meta.generatedAt));
        infoDict.set(PDFName.of('TSB_Platform'), PDFString.of('TreidingSB'));
      }
    }
  } catch (e) {
    // metadatele ascunse sunt un bonus, nu blocam personalizarea daca esueaza
  }
}

async function personalizeReportPdf(rawPdfBytes, { email, lang, reportDate }) {
  const t = LEGAL[lang] || LEGAL.ro;
  const langKey = LEGAL[lang] ? lang : 'ro';
  const timestamp = Date.now();

  const memberId = deriveMemberId(email);
  const reportNumber = deriveReportNumber(email, reportDate, timestamp);
  const hashId = deriveHashId(email, reportDate, timestamp);
  const generatedAtIso = new Date(timestamp).toISOString();
  const dateDisplay = formatDate(reportDate, langKey);

  const [regularBytes, boldBytes] = await Promise.all([
    fetch(FONT_REGULAR_URL).then((r) => r.arrayBuffer()),
    fetch(FONT_BOLD_URL).then((r) => r.arrayBuffer())
  ]);

  const pdfDoc = await PDFDocument.load(rawPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });

  const [pageWidth, pageHeight] = PAGE_SIZE;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;

  // ---------- Pagina 1: Licenta personala ----------
  const introPage = pdfDoc.insertPage(0, PAGE_SIZE);
  let y = pageHeight - 100;

  drawCentered(introPage, 'TreidingSB', boldFont, 26, y, rgb(0.83, 0.69, 0.22));
  y -= 50;

  introPage.drawText(t.licensedTo, { x: margin, y, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;
  introPage.drawText(email, { x: margin, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 22;
  introPage.drawText(t.memberIdLabel, { x: margin, y, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;
  introPage.drawText(memberId, { x: margin, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 45;

  introPage.drawText(t.personalLicenseTitle, { x: margin, y, size: 15, font: boldFont, color: rgb(0.55, 0.05, 0.05) });
  y -= 26;

  t.personalLicenseBody.forEach((para) => {
    if (para === '') {
      y -= 10;
      return;
    }
    const lines = wrapText(para, font, 11, contentWidth);
    lines.forEach((line) => {
      introPage.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
    });
  });

  y -= 30;
  introPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 26;

  const idRows = [
    [t.reportLabel, reportNumber],
    [t.memberLabel, memberId],
    [t.hashLabel, hashId],
    [t.generatedLabel, dateDisplay]
  ];
  idRows.forEach(([label, value]) => {
    introPage.drawText(label, { x: margin, y, size: 10.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    introPage.drawText(value, { x: margin + 90, y, size: 10.5, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 17;
  });

  // ---------- Pagina finala: Copyright + declaratie legala ----------
  const finalPage = pdfDoc.addPage(PAGE_SIZE);
  let fy = pageHeight - 100;

  drawCentered(finalPage, t.copyrightTitle, boldFont, 13, fy, rgb(0.1, 0.1, 0.1));
  fy -= 28;
  t.copyrightBody.forEach((para) => {
    wrapText(para, font, 10.5, contentWidth).forEach((line) => {
      drawCentered(finalPage, line, font, 10.5, fy, rgb(0.25, 0.25, 0.25));
      fy -= 15;
    });
  });

  fy -= 30;
  finalPage.drawText(t.legalDeclTitle, { x: margin, y: fy, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  fy -= 22;
  t.legalDeclBody.forEach((para) => {
    if (para === '') {
      fy -= 8;
      return;
    }
    wrapText(para, font, 10.5, contentWidth).forEach((line) => {
      finalPage.drawText(line, { x: margin, y: fy, size: 10.5, font, color: rgb(0.2, 0.2, 0.2) });
      fy -= 15;
    });
  });

  fy -= 26;
  wrapText(t.professionalPara, font, 9.5, contentWidth).forEach((line) => {
    finalPage.drawText(line, { x: margin, y: fy, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    fy -= 13.5;
  });

  fy -= 24;
  finalPage.drawLine({
    start: { x: margin, y: fy },
    end: { x: pageWidth - margin, y: fy },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });
  fy -= 22;
  idRows.forEach(([label, value]) => {
    finalPage.drawText(label, { x: margin, y: fy, size: 9.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    finalPage.drawText(value, { x: margin + 80, y: fy, size: 9.5, font, color: rgb(0.3, 0.3, 0.3) });
    fy -= 15;
  });

  // ---------- Watermark + footer pe TOATE paginile ----------
  const allPages = pdfDoc.getPages();
  allPages.forEach((page) => {
    drawWatermark(page, font, t, email);
    drawFooter(page, font, t, email, dateDisplay, reportNumber);
  });

  // ---------- Metadate ascunse ----------
  setHiddenMetadata(pdfDoc, {
    email,
    memberId,
    reportNumber,
    hashId,
    generatedAt: generatedAtIso
  });

  const bytes = await pdfDoc.save();
  return { bytes, memberId, reportNumber, hashId };
}

export { personalizeReportPdf, deriveMemberId, deriveReportNumber, deriveHashId };
