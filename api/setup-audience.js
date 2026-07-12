// api/setup-audience.js
// TEMPORAR — folosit o singura data pentru a crea Resend Audience-ul de abonati.
// Se sterge din repo dupa ce ID-ul audience-ului e recuperat si hardcodat
// in celelalte endpointuri (send-email.js / broadcast-report.js).
export default async function handler(req, res) {
  const key = req.query && req.query.key;
  if (key !== "tsb-setup-2026-tmp") {
    return res.status(403).json({ error: "forbidden" });
  }

  try {
    const response = await fetch("https://api.resend.com/audiences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "TreidingSB Subscribers" })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    return res.status(200).json({ success: true, audience: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
