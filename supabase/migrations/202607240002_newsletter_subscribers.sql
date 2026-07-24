-- Migrare separata (NU modifica migrarile deja aplicate). Ruleaza manual
-- (`supabase db push` sau paste in Supabase SQL Editor) DOAR dupa aprobare
-- separata - acest fisier nu e inclus automat in niciun deploy si nu se
-- executa singur.
--
-- Scop: lista permanenta de abonati la notificari prin email (rapoarte noi /
-- update-uri), separata complet de public.subscriptions (abonamentul PREMIUM
-- platit, care controleaza rolurile free/member/admin si accesul la idei si
-- rapoarte - acel tabel NU este atins de aceasta migrare). Un vizitator poate
-- fi abonat la notificari prin email fara sa aiba niciun cont (auth.users)
-- si fara niciun abonament premium; de-aia public.newsletter_subscribers nu
-- are nicio relatie / foreign key catre auth.users sau public.profiles.
--
-- Model de securitate (defense-in-depth, acelasi tipar ca la
-- public.report_downloads, dar mai strict - vezi mai jos):
--   1) RLS activat, ZERO policy-uri definite -> la nivel RLS, doar
--      service_role (care ocoleste RLS) poate citi/scrie ceva in tabel;
--      orice cerere authenticated/anon e respinsa implicit de RLS chiar
--      daca ar avea vreun privilegiu SQL brut.
--   2) Privilegii SQL explicite ca a doua bariera independenta: "revoke all
--      privileges" complet pentru anon si authenticated (nu doar
--      insert/update/delete - vezi 202607230002_harden_report_downloads_privileges.sql
--      pentru motivul exact: Supabase acorda implicit si REFERENCES,
--      TRIGGER, TRUNCATE la crearea oricarui tabel nou in schema public).
--      Spre deosebire de report_downloads, aici NU se reacorda SELECT catre
--      authenticated - niciun cont obisnuit sau admin autentificat prin
--      clientul cu tokenul lui de utilizator nu poate citi acest tabel in
--      niciun fel; singura cale de citire/scriere este service_role,
--      folosit exclusiv server-side (api/_lib/newsletter.js), dupa ce
--      admin.js/api/admin/[name].js a validat deja sesiunea de admin prin
--      requireAdmin() pentru citire.
--
-- Tokenul de dezabonare (unsubscribe_token_hash) este generat criptografic
-- pe server (crypto.randomBytes) si NICIODATA salvat in clar - se salveaza
-- doar hash-ul SHA-256 al tokenului, exact ca la tokenul de resetare parola
-- (vezi api/_lib/store.js). Tokenul brut e trimis o singura data, prin
-- linkul din email, si nu e niciodata jurnalizat.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  lang text not null default 'ro' check (lang in ('ro','en','ru','uk','pl')),
  status text not null default 'active' check (status in ('active','unsubscribed')),
  unsubscribe_token_hash text not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'Lista permanenta de abonati la notificari prin email (rapoarte/update-uri). Distincta de public.subscriptions (abonamentul premium platit) - nu controleaza roluri sau acces la continut. Scrisa/citita EXCLUSIV server-side prin service_role (bypass RLS), din api/_lib/newsletter.js si api/admin/[name].js.';
comment on column public.newsletter_subscribers.email is
  'Normalizat la lowercase inainte de insert/update (facut in aplicatie, in api/_lib/newsletter.js) - constrangerea unique presupune valori deja normalizate.';
comment on column public.newsletter_subscribers.unsubscribe_token_hash is
  'SHA-256 al tokenului de dezabonare. Tokenul brut nu este niciodata salvat in baza de date, doar trimis o singura data prin linkul din email si nu este jurnalizat.';
comment on column public.newsletter_subscribers.status is
  'active = primeste notificari; unsubscribed = dezabonat, pastrat in tabel (nu se sterge randul) pentru a putea fi reactivat daca se reaboneaza cu aceeasi adresa.';

create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status);
create index newsletter_subscribers_unsubscribe_token_hash_idx on public.newsletter_subscribers (unsubscribe_token_hash);

alter table public.newsletter_subscribers enable row level security;

-- Intentionat: NICIO policy RLS definita pentru anon/authenticated (nici
-- macar select) - la nivel RLS tabelul este complet inaccesibil oricui in
-- afara de service_role (care ocoleste RLS in Supabase). Toate operatiile
-- (abonare, dezabonare, listare in panoul de admin) trec exclusiv prin
-- server, folosind clientul cu service_role din api/_lib/supabase.js.

-- Privilegii explicite (a doua bariera independenta fata de RLS): anon si
-- authenticated nu primesc niciun privilegiu pe acest tabel - nici SELECT,
-- nici INSERT/UPDATE/DELETE, nici TRUNCATE/TRIGGER/REFERENCES. Doar
-- service_role primeste toate privilegiile.
revoke all privileges on table public.newsletter_subscribers from anon;
revoke all privileges on table public.newsletter_subscribers from authenticated;

grant all privileges on table public.newsletter_subscribers to service_role;
