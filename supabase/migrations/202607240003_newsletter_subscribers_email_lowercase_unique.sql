-- Migrare separata (NU modifica migrarile deja aplicate, inclusiv
-- 202607240002_newsletter_subscribers.sql). Ruleaza manual (`supabase db
-- push` sau paste in Supabase SQL Editor) DOAR dupa aprobare separata -
-- acest fisier nu e inclus automat in niciun deploy si nu se executa
-- singur.
--
-- Scop: corecteaza o limitare cunoscuta a migrarii precedente -
-- constrangerea `unique (email)` de pe public.newsletter_subscribers este
-- case-sensitive la nivel SQL brut, deci unicitatea case-insensitive era
-- garantata DOAR de normalizarea din aplicatie (normalizeEmail() din
-- api/_lib/newsletter.js), nu si de baza de date insasi. Aceasta migrare
-- adauga o a doua bariera, la nivel de schema, independenta de codul
-- aplicatiei:
--
--   1) O constrangere CHECK care impune ca valoarea stocata in coloana
--      email sa fie deja normalizata (lowercase, fara spatii la capete).
--      Orice insert/update care ar incerca sa scrie o valoare
--      ne-normalizata (ex: "Client@Email.com") este respins direct de baza
--      de date, indiferent de ce face codul aplicatiei.
--   2) Un index UNIC pe lower(email), ca bariera suplimentara independenta
--      de constrangerea unique(email) deja existenta (creata de migrarea
--      202607240002) - garanteaza ca nu pot exista doua randuri a caror
--      email difera doar prin litere mari/mici (ex: "Client@Email.com" si
--      "client@email.com"), chiar daca CHECK-ul de mai sus ar fi ocolit
--      cumva.
--
-- Nu modifica si nu sterge date existente (tabelul este gol la momentul
-- scrierii acestei migrari - verificat separat, read-only, inainte de
-- commit). Nu modifica RLS, politici sau privilegii - ramane exact ca in
-- migrarea 202607240002: RLS activ, zero policy-uri, zero privilegii
-- pentru anon/authenticated, toate privilegiile pentru service_role. Nu
-- modifica niciun endpoint, frontend, migrarile deja executate, `main`,
-- Production sau variabile de mediu.

alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_email_lowercase_check
  check (email = lower(btrim(email)));

create unique index newsletter_subscribers_email_lower_unique
  on public.newsletter_subscribers (lower(email));

comment on constraint newsletter_subscribers_email_lowercase_check on public.newsletter_subscribers is
  'Impune ca email sa fie deja normalizat (lowercase, fara spatii la capete) inainte de a fi stocat - bariera la nivel de schema, independenta de normalizeEmail() din api/_lib/newsletter.js.';
