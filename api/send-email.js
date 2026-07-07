// api/send-email.js
// Functie serverless Vercel — trimite emailuri prin Resend
// Suporta 4 limbi: ro (implicit), en, ru, pl — parametrul "lang"
// Cheia API este citita din Environment Variable (RESEND_API_KEY), NU din cod.

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
  const paras = paragraphs.map(p => `<p>${p}</p>`).join('');
  return `
    <div style="background:#0D1117; padding:24px; text-align:center; border-radius:8px 8px 0 0;">
      <img src="https://treidingsb.com/logo.png" alt="TreidingSB" width="140">
    </div>
    <div style="padding:24px; font-family:Arial,sans-serif; color:#222;">
      <h2 style="color:#D4AF37; margin-top:0;">${title}</h2>
      ${paras}
      <p style="margin-top:20px;">
        <a href="${btnUrl}" style="background:#D4AF37; color:#0D1117;
        padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
        ${btnText}</a>
      </p>
      <p style="color:#888; font-size:12px; border-top:1px solid #eee; padding-top:12px; margin-top:24px;">
        ${disclaimer}
      </p>
    </div>`;
}

export default async function handler(req, res) {
  // Acceptam doar cereri POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

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
