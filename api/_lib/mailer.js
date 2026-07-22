// api/lib/mailer.js
// Trimite emailul de resetare a parolei prin Resend. Separat de
// api/send-email.js (care e un endpoint public ce trimite doar sabloane
// predefinite, declansate de pe formularul de abonare) - aici linkul contine
// un token generat exclusiv server-side in auth-forgot-password.js, deci
// logica de trimitere n-are ce cauta intr-un endpoint public reutilizabil.

const i18n = {
  ro: {
    subject: 'Resetează-ți parola TreidingSB',
    title: 'Resetare parolă',
    text1: 'Am primit o cerere de resetare a parolei pentru contul tău TreidingSB.',
    text2: 'Linkul de mai jos este valabil 1 oră și poate fi folosit o singură dată.',
    text3: 'Dacă nu ai cerut tu această resetare, poți ignora acest email - parola ta rămâne neschimbată.',
    btn: 'Setează o parolă nouă',
    disclaimer: 'TreidingSB &middot; Analiza educationala &middot; Nu constituie sfat de investitii'
  },
  en: {
    subject: 'Reset your TreidingSB password',
    title: 'Password reset',
    text1: 'We received a request to reset the password for your TreidingSB account.',
    text2: 'The link below is valid for 1 hour and can be used only once.',
    text3: 'If you did not request this, you can safely ignore this email - your password stays unchanged.',
    btn: 'Set a new password',
    disclaimer: 'TreidingSB &middot; Educational analysis &middot; Not investment advice'
  },
  ru: {
    subject: 'Сброс пароля TreidingSB',
    title: 'Сброс пароля',
    text1: 'Мы получили запрос на сброс пароля для вашего аккаунта TreidingSB.',
    text2: 'Ссылка ниже действительна 1 час и может быть использована только один раз.',
    text3: 'Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо - ваш пароль останется прежним.',
    btn: 'Задать новый пароль',
    disclaimer: 'TreidingSB &middot; Образовательная аналитика &middot; Не является инвестиционной рекомендацией'
  },
  uk: {
    subject: 'Скидання пароля TreidingSB',
    title: 'Скидання пароля',
    text1: 'Ми отримали запит на скидання пароля для вашого облікового запису TreidingSB.',
    text2: 'Посилання нижче дійсне 1 годину і може бути використане лише один раз.',
    text3: 'Якщо ви не надсилали цей запит, просто проігноруйте цей лист - ваш пароль залишиться незмінним.',
    btn: 'Встановити новий пароль',
    disclaimer: 'TreidingSB &middot; Освітня аналітика &middot; Не є інвестиційною порадою'
  },
  pl: {
    subject: 'Zresetuj hasło TreidingSB',
    title: 'Reset hasła',
    text1: 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta TreidingSB.',
    text2: 'Poniższy link jest ważny 1 godzinę i można go użyć tylko raz.',
    text3: 'Jeśli to nie Ty wysłałeś tę prośbę, możesz zignorować tę wiadomość - Twoje hasło pozostanie bez zmian.',
    btn: 'Ustaw nowe hasło',
    disclaimer: 'TreidingSB &middot; Analiza edukacyjna &middot; To nie jest porada inwestycyjna'
  }
};

function buildHtml(t, resetUrl) {
  const paras = [t.text1, t.text2, t.text3].map((p) => `
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
${t.title}
</h2>
${paras}
<div style="margin-top:30px;">
<a href="${resetUrl}"
style="background:#D4AF37;
color:#111111;
text-decoration:none;
padding:15px 28px;
border-radius:8px;
font-size:18px;
font-weight:bold;
display:inline-block;">
${t.btn}
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
${t.disclaimer}<br>
<strong>TreidingSB AI</strong> &middot; AI Trading Intelligence
</td>
</tr>
</table>
</div>`;
}

export async function sendPasswordResetEmail({ to, resetUrl, lang }) {
  const t = i18n[lang] || i18n.ro;
  const html = buildHtml(t, resetUrl);

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: 'TreidingSB <semnale@treidingsb.com>',
    to: [to],
    subject: t.subject,
    html
  })
});

const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Resend error');
  }
  return data;
}
