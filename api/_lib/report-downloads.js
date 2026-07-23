// api/_lib/report-downloads.js
// Inregistreaza in Supabase (tabela public.report_downloads) fiecare
// generare cu succes a unui URL semnat pentru un raport. Scrierea foloseste
// EXCLUSIV clientul cu service role (bypass RLS) - niciun utilizator, nici
// macar admin prin propriul token, nu poate insera manual in acest tabel,
// pentru ca nu exista nicio policy RLS de insert pentru rolul authenticated
// (vezi supabase/migrations/202607230001_report_downloads.sql).
//
// SUPABASE_SERVICE_ROLE_KEY nu paraseste niciodata acest fisier server-side
// si nu ajunge in niciun raspuns catre client.
//
// Apelantul (api/download-report.js) trebuie sa cheme aceasta functie DOAR
// dupa ce a validat deja sesiunea, rolul/abonamentul si a generat cu succes
// URL-ul semnat - si trebuie sa NU livreze URL-ul daca aceasta functie
// arunca o eroare, ca sa garanteze ca fiecare URL livrat are o inregistrare
// corespunzatoare.

import { getSupabaseAdmin } from './supabase.js';

export async function recordReportDownload({ userId, reportId, memberId, lang }) {
  if (!memberId) {
    throw new Error('member_id lipsa - nu se poate inregistra descarcarea');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('report_downloads').insert({
    user_id: userId || null,
    report_id: reportId || null,
    member_id: memberId,
    lang
  });

  if (error) {
    throw new Error('Nu am putut inregistra descarcarea: ' + error.message);
  }
}
