// api/download-report.js
// Livreaza raportul saptamanal curent membrilor autentificati prin cont real
// (email/parola). Inlocuieste vechiul mecanism cu parola comuna: acum orice
// descarcare trece prin sesiunea utilizatorului si este inregistrata in
// jurnalul de descarcari (vezi api/admin/downloads.js).

import { getUser, logDownload } from './lib/store.js';
import { verifySessionToken } from './lib/session.js';

const REPORTS_REPO_API = "https://api.github.com/repos/sergiuburlea37-star/treidingsb-reports/contents/reports";
const REPORT_LANGS = ["ro", "en", "ru", "uk", "pl"];

function pickReportUrl(urls, lang) {
    if (!urls) return null;
    if (lang && urls[lang]) return urls[lang];
    if (urls.ro) return urls.ro;
    const firstKey = Object.keys(urls)[0];
    return firstKey ? urls[firstKey] : null;
}

async function findLatestReport() {
    const quarterRes = await fetch(REPORTS_REPO_API);
    if (!quarterRes.ok) throw new Error("quarters fetch failed");
    const quarters = await quarterRes.json();
    const quarterDirs = (Array.isArray(quarters) ? quarters : []).filter(
          (it) => it.type === "dir" && /^Q[1-4]_\d{4}$/.test(it.name)
        );
    if (!quarterDirs.length) return null;

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
    if (!dates.length) return null;
    const latestDate = dates[0];
    const [y, m, d] = latestDate.split("-");
    return { urls: byDate[latestDate], dateStr: `${d}.${m}.${y}`, isoDate: latestDate };
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          return res.status(405).json({ error: "Method not allowed" });
    }

  const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const email = verifySessionToken(token);

  if (!email) {
        return res.status(401).json({ error: "Sesiune invalida sau expirata" });
  }

  try {
        const user = await getUser(email);
        if (!user) {
                return res.status(401).json({ error: "Cont inexistent" });
        }

      const requestedLang = req.query && req.query.lang;
        const lang = REPORT_LANGS.includes(requestedLang) ? requestedLang : (user.lang || "ro");

      const latest = await findLatestReport();
        if (!latest) {
                return res.status(200).json({ success: false });
        }
        const url = pickReportUrl(latest.urls, lang);
        if (!url) {
                return res.status(200).json({ success: false });
        }

      await logDownload({
              email: user.email,
              memberId: user.memberId,
              timestamp: Date.now(),
              reportDate: latest.isoDate,
              lang
      });

      return res.status(200).json({ success: true, url, dateStr: latest.dateStr });
  } catch (err) {
        return res.status(500).json({ error: "Server error: " + err.message });
  }
}
