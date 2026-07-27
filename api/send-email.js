// api/send-email.js
// Functie serverless Vercel — trimite emailuri prin Resend
// Suporta 5 limbi: ro (implicit), en, ru, uk, pl — parametrul "lang"
// Cheia API este citita din Environment Variable (RESEND_API_KEY), NU din cod.
//
// Acelasi endpoint gestioneaza si lista permanenta de abonati la notificari
// (public.newsletter_subscribers, vezi api/_lib/newsletter.js):
//   - la orice trimitere normala (welcome/report/update) catre o adresa,
//     abonatul e creat sau reactivat automat si primeste un link de
//     dezabonare valabil in footer-ul emailului. Persistenta abonatului
//     ramane best-effort (o eroare Supabase aici nu opreste niciodata
//     trimiterea efectiva a emailului) - dar daca persistenta REUSESTE (deci
//     exista un token real, activ, in baza de date), originea folosita
//     pentru linkul de dezabonare trebuie sa fie de incredere (vezi
//     api/_lib/site-origin.js: doar variabile de sistem Vercel, niciodata
//     headere de cerere); daca originea nu poate fi validata, trimiterea se
//     opreste cu o eroare sigura, in loc sa iasa un email cu link gresit sau
//     lipsa pentru un abonat deja activ;
//   - cu { action: "unsubscribe", token } primeste cererea de dezabonare
//     trimisa din pagina publica unsubscribe.html.
// Cheia service-role folosita pentru persistenta abonatilor nu este niciodata
// expusa in frontend, raspunsuri sau loguri - vezi api/_lib/supabase.js si
// api/_lib/newsletter.js.

import { personalizeReportPdf } from './_lib/personalize-report.js';
import {
  upsertSubscriberAndIssueToken,
  markUnsubscribedByTokenHash,
  hashUnsubscribeToken,
  isValidTokenFormat
} from './_lib/newsletter.js';
import { buildTrustedUnsubscribeUrl } from './_lib/site-origin.js';
import { createRateLimiter, getClientIp } from './_lib/ratelimit.js';

// ---------- Rate limiting (Upstash Redis, partajat intre instante) ----------
// Endpoint-ul e public (oricine poate trimite email catre orice adresa prin
// formularul de abonare, sau poate incerca dezabonari), deci fara limitare
// putea fi folosit ca releu de spam sau pentru brute-force pe tokenul de
// dezabonare. Abonarea si dezabonarea au namespace-uri separate, ca sa aiba
// fiecare propria limita, independenta una de cealalta.
const isSendRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, namespace: 'send' });
const isUnsubRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, namespace: 'unsub' });

// ---------- Texte in cele 5 limbi ----------
const i18n = {
  ro: {
    welcomeSubject: 'Bine ai venit la TreidingSB!',
    welcomeTitle: (name) => `Bine ai venit${name ? ', ' + name : ''}!`,
    welcomeText1: 'Te-ai abonat cu succes la TreidingSB.',
    welcomeText2: 'Vei primi analize si rapoarte pentru XAU/USD, XAG/USD, EUR/USD si GBP/USD, bazate pe metodologia Smart Money Concepts.',
    reportSubject: 'Raport nou disponibil pe TreidingSB',
    reportTitle: 'Raport nou disponibil!',
    reportText: 'Un nou raport de analiza a fost publicat pe site, in sectiunea Rapoarte. Il gasesti atasat la acest email in format PDF.',
    reportTextNoAttachment: 'Un nou raport de analiza a fost publicat pe site, in sectiunea Rapoarte.',
    updateSubject: 'TreidingSB s-a actualizat - rubrici noi pentru tine',
    updateTitle: 'Site-ul TreidingSB s-a actualizat!',
    updateText1: 'Am adaugat rubrici noi pe site, gandite pentru confortul tau.',
    updateText2: 'Descopera ce e nou si exploreaza site-ul actualizat, inclusiv noul Cabinet personal.',
    btnUpdate: 'Vezi ce e nou',
    btnSite: 'Viziteaza site-ul',
    btnReport: 'Citeste raportul',
    disclaimer: 'TreidingSB &middot; Analiza educationala &middot; Nu constituie sfat de investitii',
    unsubscribeLinkText: 'Dezaboneaza-te'
  },
  en: {
    welcomeSubject: 'Welcome to TreidingSB!',
    welcomeTitle: (name) => `Welcome${name ? ', ' + name : ''}!`,
    welcomeText1: 'You have successfully subscribed to TreidingSB.',
    welcomeText2: 'You will receive analysis and reports for XAU/USD, XAG/USD, EUR/USD and GBP/USD, based on the Smart Money Concepts methodology.',
    reportSubject: 'New report available on TreidingSB',
    reportTitle: 'New report available!',
    reportText: 'A new analysis report has been published on the site, in the Reports section. You will find it attached to this email as a PDF.',
    reportTextNoAttachment: 'A new analysis report has been published on the site, in the Reports section.',
    updateSubject: 'TreidingSB has been updated - new sections for you',
    updateTitle: 'The TreidingSB website has been updated!',
    updateText1: 'We have added new sections to the site, designed for your convenience.',
    updateText2: 'Discover what is new and explore the updated website, including the new personal Account area.',
    btnUpdate: 'See what is new',
    btnSite: 'Visit the website',
    btnReport: 'Read the report',
    disclaimer: 'TreidingSB &middot; Educational analysis &middot; Not investment advice',
    unsubscribeLinkText: 'Unsubscribe'
  },
  ru: {
    welcomeSubject: 'Добро пожаловать в TreidingSB!',
    welcomeTitle: (name) => `Добро пожаловать${name ? ', ' + name : ''}!`,
    welcomeText1: 'Вы успешно подписались на TreidingSB.',
    welcomeText2: 'Вы будете получать аналитику и отчёты по XAU/USD, XAG/USD, EUR/USD и GBP/USD на основе методологии Smart Money Concepts.',
    reportSubject: 'Новый отчёт доступен на TreidingSB',
    reportTitle: 'Доступен новый отчёт!',
    reportText: 'Новый аналитический отчёт опубликован на сайте, в разделе «Отчёты». Он приложен к этому письму в формате PDF.',
    reportTextNoAttachment: 'Новый аналитический отчёт опубликован на сайте, в разделе «Отчёты».',
    updateSubject: 'TreidingSB обновлён - новые разделы для вас',
    updateTitle: 'Сайт TreidingSB обновлён!',
    updateText1: 'Мы добавили новые разделы на сайт для вашего удобства.',
    updateText2: 'Узнайте, что нового, и изучите обновлённый сайт, включая новый Личный кабинет.',
    btnUpdate: 'Посмотреть новинки',
    btnSite: 'Перейти на сайт',
    btnReport: 'Читать отчёт',
    disclaimer: 'TreidingSB &middot; Образовательная аналитика &middot; Не является инвестиционной рекомендацией',
    unsubscribeLinkText: 'Отписаться'
  },
  uk: {
    welcomeSubject: 'Ласкаво просимо до TreidingSB!',
    welcomeTitle: (name) => `Ласкаво просимо${name ? ', ' + name : ''}!`,
    welcomeText1: 'Ви успішно підписалися на TreidingSB.',
    welcomeText2: 'Ви отримуватимете аналітику та звіти по XAU/USD, XAG/USD, EUR/USD та GBP/USD на основі методології Smart Money Concepts.',
    reportSubject: 'Новий звіт доступний на TreidingSB',
    reportTitle: 'Доступний новий звіт!',
    reportText: 'Новий аналітичний звіт опубліковано на сайті, у розділі «Звіти». Він доданий до цього листа у форматі PDF.',
    reportTextNoAttachment: 'Новий аналітичний звіт опубліковано на сайті, у розділі «Звіти».',
    updateSubject: 'TreidingSB оновлено - нові розділи для вас',
    updateTitle: 'Сайт TreidingSB оновлено!',
    updateText1: 'Ми додали нові розділи на сайт для вашої зручності.',
    updateText2: 'Дізнайтеся, що нового, та ознайомтеся з оновленим сайтом, включно з новим Особистим кабінетом.',
    btnUpdate: 'Переглянути новини',
    btnSite: 'Відвідати сайт',
    btnReport: 'Читати звіт',
    disclaimer: 'TreidingSB &middot; Освітня аналітика &middot; Не є інвестиційною порадою',
    unsubscribeLinkText: 'Відписатися'
  },
  pl: {
    welcomeSubject: 'Witamy w TreidingSB!',
    welcomeTitle: (name) => `Witamy${name ? ', ' + name : ''}!`,
    welcomeText1: 'Subskrypcja TreidingSB zostala pomyslnie aktywowana.',
    welcomeText2: 'Bedziesz otrzymywac analizy i raporty dla XAU/USD, XAG/USD, EUR/USD oraz GBP/USD, oparte na metodologii Smart Money Concepts.',
    reportSubject: 'Nowy raport dostepny na TreidingSB',
    reportTitle: 'Nowy raport jest dostepny!',
    reportText: 'Nowy raport analityczny zostal opublikowany na stronie, w sekcji Raporty. Znajdziesz go w zalaczniku do tej wiadomosci w formacie PDF.',
    reportTextNoAttachment: 'Nowy raport analityczny zostal opublikowany na stronie, w sekcji Raporty.',
    updateSubject: 'TreidingSB zostal zaktualizowany - nowe sekcje dla Ciebie',
    updateTitle: 'Strona TreidingSB zostala zaktualizowana!',
    updateText1: 'Dodalismy nowe sekcje na stronie, z mysla o Twojej wygodzie.',
    updateText2: 'Odkryj co nowego i zapoznaj sie z zaktualizowana strona, w tym nowe Konto osobiste.',
    btnUpdate: 'Zobacz co nowego',
    btnSite: 'Odwiedz strone',
    btnReport: 'Przeczytaj raport',
    disclaimer: 'TreidingSB &middot; Analiza edukacyjna &middot; To nie jest porada inwestycyjna',
    unsubscribeLinkText: 'Wypisz sie'
  }
};

// ---------- Constructor HTML comun (logo + buton + disclaimer) ----------
function buildHtml(title, paragraphs, btnText, btnUrl, disclaimer, unsubscribeHtml) {
  const paras = paragraphs.map(p => `
      <p style="margin:0 0 18px 0;font-size:18px;line-height:1.6;color:#E6E6E6;">
        ${p}
      </p>
    `).join('');

  return `
  <div style="background:#111111;padding:30px 0;font-family:Arial,sans-serif;">
    <table align="center" cellpadding="0" cellspacing="0" width="700"
      style="max-width:700px;width:100%;background:#1A1A1A;border-radius:18px;overflow:hidden;">

      <tr>
        <td>
          <img
            src="https://treidingsb.com/assets/email-banner-v2.jpg"
            alt="TreidingSB AI"
            width="700"
            style="display:block;width:100%;height:auto;border:0;">
        </td>
      </tr>

      <tr>
        <td style="padding:35px;">
          <h2 style="color:#D4AF37;font-size:32px;margin:0 0 20px 0;">
            ${title}
          </h2>

          ${paras}

          <div style="margin-top:30px;">
            <a href="${btnUrl}"
              style="background:#D4AF37;
                     color:#111111;
                     text-decoration:none;
                     padding:15px 28px;
                     border-radius:8px;
                     font-size:18px;
                     font-weight:bold;
                     display:inline-block;">
              ${btnText}
            </a>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:22px 35px;
                   border-top:1px solid #2B2B2B;
                   color:#8C8C8C;
                   font-size:13px;
                   line-height:1.6;">
          ${disclaimer}<br>
          <strong>TreidingSB AI</strong> &middot; AI Trading Intelligence
          ${unsubscribeHtml ? `<br>${unsubscribeHtml}` : ''}
        </td>
      </tr>

    </table>
  </div>`;
}

// ---------- Descarca ultimul raport PDF brut (best-effort) ----------
async function fetchLatestReportRaw(lang) {
  try {
    const idxRes = await fetch('https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/reports/index.json');
    if (!idxRes.ok) return null;
    const idxData = await idxRes.json();
    const latest = idxData && idxData.rapoarte && idxData.rapoarte[0];
    if (!latest) return null;

    const relPath =
      (latest.fisiere && (latest.fisiere[lang] || latest.fisiere.ro)) ||
      latest.fisier;
    if (!relPath) return null;

    const pdfRes = await fetch(`https://raw.githubusercontent.com/sergiuburlea37-star/treidingsb-reports/main/reports/${relPath}`);
    if (!pdfRes.ok) return null;

    const buf = Buffer.from(await pdfRes.arrayBuffer());
    return { buf, reportDate: latest.data };
  } catch (e) {
    return null;
  }
}

// ---------- Personalizeaza si ataseaza raportul (best-effort) ----------
// Fiecare abonat primeste un PDF unic: pagina de licenta personala, watermark
// cu emailul lui pe fiecare pagina, ID de raport unic, hash unic, pagina
// finala de copyright/declaratie legala si metadate ascunse in fisier
// (email, member ID, report ID, timestamp). Daca personalizarea esueaza
// dintr-un motiv tehnic, atasam raportul brut ca sa nu blocam niciodata
// trimiterea notificarii — dar incercam intotdeauna varianta personalizata
// mai intai, niciodata nu trimitem intentionat o copie anonima.
async function fetchLatestReportAttachment(lang, email) {
  const raw = await fetchLatestReportRaw(lang);
  if (!raw) return null;

  try {
    const { bytes, reportNumber } = await personalizeReportPdf(raw.buf, {
      email,
      lang,
      reportDate: raw.reportDate
    });
    return {
      filename: `TreidingSB_Raport_${raw.reportDate}_${reportNumber}.pdf`,
      content: Buffer.from(bytes).toString('base64')
    };
  } catch (e) {
    return {
      filename: `TreidingSB_Raport_${raw.reportDate}.pdf`,
      content: raw.buf.toString('base64')
    };
  }
}

// ---------- Dezabonare ----------
// Primeste { action: "unsubscribe", token } din pagina publica
// unsubscribe.html. Raspunsul nu contine niciodata tokenul sau emailul
// asociat, iar erorile nu sunt niciodata jurnalizate cu detalii sensibile -
// doar succes/esec generic, exact cat ii trebuie paginii sa afiseze una din
// cele 3 stari (succes / link invalid ori expirat / eroare temporara).
async function handleUnsubscribe(req, res, body) {
  const clientIp = getClientIp(req);
  if (await isUnsubRateLimited(clientIp)) {
    return res.status(429).json({ success: false, reason: 'rate_limited' });
  }

  const { token } = body;
  if (!isValidTokenFormat(token)) {
    return res.status(400).json({ success: false, reason: 'invalid' });
  }

  try {
    const tokenHash = hashUnsubscribeToken(token);
    const unsubscribed = await markUnsubscribedByTokenHash(tokenHash);
    if (!unsubscribed) {
      return res.status(404).json({ success: false, reason: 'invalid' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, reason: 'error' });
  }
}

// ---------- Trimitere email (welcome / report / update) ----------
async function handleSend(req, res, body) {
  const clientIp = getClientIp(req);
  if (await isSendRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { to, type, name, lang } = body;

  // Validare simpla a adresei de email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Missing or invalid email address.' });
  }

  // Limba: ro / en / ru / uk / pl — implicit ro
  const t = i18n[lang] || i18n.ro;

  // Lista permanenta de abonati (best-effort): creeaza sau reactiveaza
  // abonatul si emite un token nou de dezabonare pentru linkul din acest
  // email. O eroare aici (Supabase indisponibil, configurare lipsa etc.) NU
  // trebuie sa opreasca trimiterea efectiva a emailului - notificarile
  // existente raman functionale indiferent de starea persistentei.
  let rawSubscriberToken = null;
  try {
    rawSubscriberToken = await upsertSubscriberAndIssueToken({ email: to, lang });
  } catch (e) {
    rawSubscriberToken = null;
  }

  // Daca abonatul a fost persistat cu succes (exista un token real, activ,
  // in baza de date), linkul de dezabonare TREBUIE sa foloseasca o origine de
  // incredere (vezi api/_lib/site-origin.js - doar variabile de sistem
  // Vercel, niciodata req.headers.host/origin/referer, care sunt
  // controlabile de client). Daca originea nu poate fi determinata/validata
  // in siguranta, nu trimitem deloc emailul, ca sa nu iasa o notificare cu
  // link de dezabonare gresit sau lipsa pentru un abonat deja activ. Acest
  // lucru e independent de persistenta best-effort de mai sus: daca
  // persistenta insasi a esuat (rawSubscriberToken ramane null), nu exista
  // niciun token de pus intr-un link, iar trimiterea emailului continua
  // normal, fara link de dezabonare - comportament neschimbat.
  let unsubscribeUrl = null;
  if (rawSubscriberToken) {
    unsubscribeUrl = buildTrustedUnsubscribeUrl(rawSubscriberToken);
    if (!unsubscribeUrl) {
      return res.status(500).json({ error: 'Server error: unable to determine a trusted link origin.' });
    }
  }

  const unsubscribeHtml = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#8C8C8C;text-decoration:underline;">${t.unsubscribeLinkText}</a>`
    : '';

  // Template-uri predefinite (serverul decide continutul, nu vizitatorul)
  let subject, html;
  let attachments;

  if (type === 'report') {
    attachments = await fetchLatestReportAttachment(lang, to);

    subject = t.reportSubject;
    html = buildHtml(
      t.reportTitle,
      [attachments ? t.reportText : t.reportTextNoAttachment],
      t.btnReport,
      'https://treidingsb.com',
      t.disclaimer,
      unsubscribeHtml
    );
  } else if (type === 'update') {
    subject = t.updateSubject;
    html = buildHtml(
      t.updateTitle,
      [t.updateText1, t.updateText2],
      t.btnUpdate,
      'https://treidingsb.com/#account',
      t.disclaimer,
      unsubscribeHtml
    );
  } else {
    // implicit: welcome
    subject = t.welcomeSubject;
    html = buildHtml(
      t.welcomeTitle(name),
      [t.welcomeText1, t.welcomeText2],
      t.btnSite,
      'https://treidingsb.com',
      t.disclaimer,
      unsubscribeHtml
    );
  }

  try {
    const emailPayload = {
      from: 'TreidingSB <semnale@treidingsb.com>',
      to: [to],
      subject: subject,
      html: html
    };
    if (attachments) {
      emailPayload.attachments = [attachments];
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Error sending email.' });
    }

    // La abonare (welcome): notificare catre proprietar cu adresa noului abonat
    if (type !== 'report' && type !== 'update') {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'TreidingSB <semnale@treidingsb.com>',
            to: ['semnale@treidingsb.com'],
            subject: 'Abonat nou pe TreidingSB',
            html: `<p>Abonat nou la rapoarte:</p><p><b>${to}</b></p><p>Limba: ${lang || 'ro'}</p>`
          })
        });
      } catch (e) { /* notificarea nu blocheaza raspunsul */ }
    }

    return res.status(200).json({ success: true, id: data.id, attached: !!attachments });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

export default async function handler(req, res) {
  // Acceptam doar cereri POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = req.body || {};

  if (body.action === 'unsubscribe') {
    return handleUnsubscribe(req, res, body);
  }

  return handleSend(req, res, body);
}
