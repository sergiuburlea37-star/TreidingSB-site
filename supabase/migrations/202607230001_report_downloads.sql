-- Migrare separata (NU modifica 202607220001_secure_premium_access.sql sau
-- 002_admin_bootstrap.sql, deja aplicate). Ruleaza manual (`supabase db push`
-- sau paste in Supabase SQL Editor) DOAR dupa aprobare separata - acest
-- fisier nu e inclus automat in niciun deploy si nu se executa singur.
--
-- Scop: evidenta ("audit trail") a fiecarei generari CU SUCCES a unui URL
-- semnat pentru un raport. O inregistrare = un URL semnat generat cu succes
-- de server, nu neaparat un fisier PDF descarcat efectiv de browser (un
-- signed URL poate fi generat si apoi neaccesat, sau browserul poate opri
-- transferul). De-aia interfata de admin numeste aceasta valoare
-- "descarcari initiate" / "accesari generate", nu "descarcari confirmate".

create table public.report_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  member_id text not null,
  lang text not null check (lang in ('ro','en','ru','uk','pl')),
  downloaded_at timestamptz not null default now()
);

comment on table public.report_downloads is
  'Audit: un rand per URL semnat generat cu succes pentru un raport (nu inseamna neaparat descarcare confirmata de browser).';
comment on column public.report_downloads.member_id is
  'Copie a member_id la momentul descarcarii, pastrata ca valoare de audit independenta - randul supravietuieste chiar daca profilul e sters sau member_id se schimba ulterior.';
comment on column public.report_downloads.user_id is
  'Referinta catre profiles.id. La stergerea profilului randul de audit NU se sterge (on delete set null) - member_id ramane dovada cine a descarcat.';
comment on column public.report_downloads.report_id is
  'Referinta catre reports.id. La stergerea raportului randul de audit NU se sterge (on delete set null).';

create index report_downloads_downloaded_at_idx on public.report_downloads (downloaded_at desc);
create index report_downloads_user_id_idx on public.report_downloads (user_id);
create index report_downloads_report_id_idx on public.report_downloads (report_id);

alter table public.report_downloads enable row level security;

-- Doar administratorii pot citi istoricul - foloseste functia deja existenta
-- public.is_admin() (definita in 202607220001_secure_premium_access.sql),
-- exact ca politicile "_admin_all" de pe subscriptions/trading_ideas/reports.
create policy report_downloads_admin_select on public.report_downloads
  for select to authenticated
  using (public.is_admin());

-- Intentionat: NU exista nicio policy de insert/update/delete pentru rolul
-- authenticated (nici macar pentru admin, prin clientul cu tokenul lui de
-- utilizator) - niciun cont obisnuit sau admin nu poate scrie manual in
-- acest tabel din aplicatie sau din SQL editor conectat ca "authenticated".
-- Singura cale de inserare este clientul cu service role (bypass RLS),
-- folosit EXCLUSIV server-side in api/_lib/report-downloads.js, dupa ce
-- serverul a validat deja sesiunea, rolul/abonamentul si a generat cu
-- succes URL-ul semnat al raportului (vezi api/download-report.js).
grant select on public.report_downloads to authenticated;
