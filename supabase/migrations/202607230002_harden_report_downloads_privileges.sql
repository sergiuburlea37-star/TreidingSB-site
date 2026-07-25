-- Migrare separata (NU modifica 202607230001_report_downloads.sql, deja
-- executata). Ruleaza manual (`supabase db push` sau paste in Supabase SQL
-- Editor) DOAR dupa aprobare separata - acest fisier nu e inclus automat in
-- niciun deploy si nu se executa singur.
--
-- Motiv: verificarea read-only de dupa 202607230001 a aratat ca rolul
-- authenticated mai avea, pe langa SELECT, privilegiile REFERENCES, TRIGGER
-- si TRUNCATE pe public.report_downloads - ramase din privilegiile implicite
-- pe care Supabase le acorda automat rolurilor anon/authenticated la crearea
-- oricarui tabel nou in schema public, neatinse de acel revoke (care viza
-- explicit doar insert/update/delete). TRUNCATE e cel mai important dintre
-- ele: RLS nu se aplica la comanda TRUNCATE, deci orice cont authenticated
-- ar fi putut goli tot jurnalul de audit dintr-o singura comanda.
--
-- Aceasta migrare inlocuieste privilegiile lui anon si authenticated cu un
-- "revoke all" complet, apoi reacorda explicit DOAR select catre
-- authenticated - eliminand astfel si references/trigger/truncate, nu doar
-- insert/update/delete. RLS (policy-ul report_downloads_admin_select,
-- definit in 202607230001) ramane neschimbat si continua sa fie singurul
-- filtru care decide CE randuri poate citi efectiv authenticated (doar
-- is_admin()).

revoke all privileges on table public.report_downloads from anon;
revoke all privileges on table public.report_downloads from authenticated;

grant select on table public.report_downloads to authenticated;
grant all privileges on table public.report_downloads to service_role;
