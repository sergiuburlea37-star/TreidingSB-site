// api/send-email.js
// Functie serverless Vercel — trimite emailuri prin Resend
// Suporta 4 limbi: ro (implicit), en, ru, pl — parametrul "lang"
// Cheia API este citita din Environment Variable (RESEND_API_KEY), NU din cod.

// ---------- Rate limiting simplu (in-memory, per instanta) ----------
// Endpoint-ul e public (oricine poate trimite email catre orice adresa prin
// formularul de abonare), deci fara limitare putea fi folosit ca releu de spam.
// Nu e un rate-limiter distribuit — se reseteaza la fiecare cold start si nu e
// partajat intre instante/regiuni Vercel — dar opreste rafalele simple de pe
// aceeasi conexiune. Pentru protectie robusta pe termen lung, urmatorul pas ar
// fi Vercel KV / Upstash Redis.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minute
const RATE_LIMIT_MAX = 5; // max 5 cereri / IP / fereastra
const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// Curata periodic intrarile vechi ca Map-ul sa nu creasca la nesfarsit intr-o
// instanta warm de lunga durata.
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}

// ---------- Texte in cele 4 limbi ----------
const i18n = {
  ro: {
    welcomeSubject: 'Bine ai venit la TreidingSB!',
    welcomeTitle: (name) => `Bine ai venit${name ? ', ' + name : ''}!`,
    welcomeText1: 'Te-ai abonat cu succes la TreidingSB.',
    welcomeText2: 'Vei primi analize si rapoarte pentru XAU/USD, XAG/USD, EUR/USD si GBP/USD, bazate pe metodologia Smart Money Concepts.',
    reportSubject: 'Raport nou disponibil pe TreidingSB',
    reportTitle: 'Raport nou disponibil!',
    reportText: 'Un nou raport de analiza a fost publicat pe site, in sectiunea Rapoarte.',
    btnSite: 'Viziteaza site-ul',
    btnReport: 'Citeste raportul',
    disclaimer: 'TreidingSB &middot; Analiza educationala &middot; Nu constituie sfat de investitii'
  },
  en: {
    welcomeSubject: 'Welcome to TreidingSB!',
    welcomeTitle: (name) => `Welcome${name ? ', ' + name : ''}!`,
    welcomeText1: 'You have successfully subscribed to TreidingSB.',
    welcomeText2: 'You will receive analysis and reports for XAU/USD, XAG/USD, EUR/USD and GBP/USD, based on the Smart Money Concepts methodology.',
    reportSubject: 'New report available on TreidingSB',
    reportTitle: 'New report available!',
    reportText: 'A new analysis report has been published on the site, in the Reports section.',
    btnSite: 'Visit the website',
    btnReport: 'Read the report',
    disclaimer: 'TreidingSB &middot; Educational analysis &middot; Not investment advice'
  },
  ru: {
    welcomeSubject: 'Добро пожаловать в TreidingSB!',
    welcomeTitle: (name) => `Добро пожаловать${name ? ', ' + name : ''}!`,
    welcomeText1: 'Вы успешно подписались на TreidingSB.',
    welcomeText2: 'Вы будете получать аналитику и отчёты по XAU/USD, XAG/USD, EUR/USD и GBP/USD на основе методологии Smart Money Concepts.',
    reportSubject: 'Новый отчёт доступен на TreidingSB',
    reportTitle: 'Доступен новый отчёт!',
    reportText: 'Новый аналитический отчёт опубликован на сайте, в разделе «Отчёты».',
    btnSite: 'Перейти на сайт',
    btnReport: 'Читать отчёт',
    disclaimer: 'TreidingSB &middot; Образовательная аналитика &middot; Не является инвестиционной рекомендацией'
  },
  pl: {
    welcomeSubject: 'Witamy w TreidingSB!',
    welcomeTitle: (name) => `Witamy${name ? ', ' + name : ''}!`,
    welcomeText1: 'Subskrypcja TreidingSB zostala pomyslnie aktywowana.',
    welcomeText2: 'Bedziesz otrzymywac analizy i raporty dla XAU/USD, XAG/USD, EUR/USD oraz GBP/USD, oparte na metodologii Smart Money Concepts.',
    reportSubject: 'Nowy raport dostepny na TreidingSB',
    reportTitle: 'Nowy raport jest dostepny!',
    reportText: 'Nowy raport analityczny zostal opublikowany na stronie, w sekcji Raporty.',
    btnSite: 'Odwiedz strone',
    btnReport: 'Przeczytaj raport',
    disclaimer: 'TreidingSB &middot; Analiza edukacyjna &middot; To nie jest porada inwestycyjna'
  }
};

// ---------- Constructor HTML comun (logo + buton + disclaimer) ----------
function buildHtml(title, paragraphs, btnText, btnUrl, disclaimer) {
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
              src="https://treidingsb.com/email-banner.jpg"
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
            <strong>TreidingSB AI</strong> · AI Trading Intelligence
          </td>
        </tr>

      </table>
    </div>`;
}

export default async function handler(req, res) {
  // Acceptam doar cereri POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Rate limiting: max RATE_LIMIT_MAX cereri per IP la fiecare RATE_LIMIT_WINDOW_MS
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  if (Math.random() < 0.02) cleanupRateLimitStore();

  const { to, type, name, lang } = req.body || {};

  // Validare simpla a adresei de email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Missing or invalid email address.' });
  }

  // Limba: ro / en / ru / pl — implicit ro
  const t = i18n[lang] || i18n.ro;

  // Template-uri predefinite (serverul decide continutul, nu vizitatorul)
  let subject, html;

  if (type === 'report') {
    subject = t.reportSubject;
    html = buildHtml(
      t.reportTitle,
      [t.reportText],
      t.btnReport,
      'https://treidingsb.com',
      t.disclaimer
    );
  } else {
    // implicit: welcome
    subject = t.welcomeSubject;
    html = buildHtml(
      t.welcomeTitle(name),
      [t.welcomeText1, t.welcomeText2],
      t.btnSite,
      'https://treidingsb.com',
      t.disclaimer
    );
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TreidingSB <semnale@treidingsb.com>',
        to: [to],
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Error sending email.' });
    }

    // La abonare (welcome): notificare catre proprietar cu adresa noului abonat
    if (type !== 'report') {
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

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
