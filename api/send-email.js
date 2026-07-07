// api/send-email.js
// Functie serverless Vercel — trimite emailuri prin Resend
// Cheia API este citita din Environment Variable (RESEND_API_KEY), NU din cod.

export default async function handler(req, res) {
  // Acceptam doar cereri POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda nu este permisa. Foloseste POST.' });
  }

  const { to, type, name } = req.body || {};

  // Validare simpla a adresei de email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Adresa de email lipseste sau este invalida.' });
  }

  // Template-uri predefinite (serverul decide continutul, nu vizitatorul —
  // astfel endpoint-ul nu poate fi folosit pentru spam cu text arbitrar)
  const templates = {
    // Confirmare abonare la newsletter / semnale
    welcome: {
      subject: 'Bine ai venit la TreidingSB!',
      html: `
        <div style="background:#0D1117; padding:24px; text-align:center; border-radius:8px 8px 0 0;">
          <img src="https://treidingsb.com/logo.png" alt="TreidingSB" width="140">
        </div>
        <div style="padding:24px; font-family:Arial,sans-serif; color:#222;">
          <h2 style="color:#D4AF37; margin-top:0;">Bine ai venit${name ? ', ' + name : ''}!</h2>
          <p>Te-ai abonat cu succes la TreidingSB.</p>
          <p>Vei primi analize si rapoarte pentru XAU/USD, XAG/USD, EUR/USD si GBP/USD,
          bazate pe metodologia Smart Money Concepts.</p>
          <p style="margin-top:20px;">
            <a href="https://treidingsb.com" style="background:#D4AF37; color:#0D1117;
            padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
            Viziteaza site-ul</a>
          </p>
          <p style="color:#888; font-size:12px; border-top:1px solid #eee; padding-top:12px; margin-top:24px;">
            TreidingSB &middot; Analiza educationala &middot; Nu constituie sfat de investitii
          </p>
        </div>`
    },

    // Notificare generica de raport nou publicat
    report: {
      subject: 'Raport nou disponibil pe TreidingSB',
      html: `
        <div style="background:#0D1117; padding:24px; text-align:center; border-radius:8px 8px 0 0;">
          <img src="https://treidingsb.com/logo.png" alt="TreidingSB" width="140">
        </div>
        <div style="padding:24px; font-family:Arial,sans-serif; color:#222;">
          <h2 style="color:#D4AF37; margin-top:0;">Raport nou disponibil!</h2>
          <p>Un nou raport de analiza a fost publicat pe site, in sectiunea Rapoarte.</p>
          <p style="margin-top:20px;">
            <a href="https://treidingsb.com" style="background:#D4AF37; color:#0D1117;
            padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
            Citeste raportul</a>
          </p>
          <p style="color:#888; font-size:12px; border-top:1px solid #eee; padding-top:12px; margin-top:24px;">
            TreidingSB &middot; Analiza educationala &middot; Nu constituie sfat de investitii
          </p>
        </div>`
    }
  };

  const template = templates[type] || templates.welcome;

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
        subject: template.subject,
        html: template.html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Eroare la trimiterea emailului.' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: 'Eroare de server: ' + err.message });
  }
}
