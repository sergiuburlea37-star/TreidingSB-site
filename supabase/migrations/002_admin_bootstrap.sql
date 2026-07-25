-- Ruleaza ACESTA dupa 202607220001_secure_premium_access.sql (paste in
-- Supabase SQL Editor si Run, o singura data).
--
-- Motiv: la crearea contului, handle_new_user() seteaza mereu role='free'.
-- Nimeni nu ar deveni admin fara interventie manuala in baza de date. Acest
-- script inlocuieste functia ca sa promoveze automat la 'admin' contul cu
-- adresa de administrator a site-ului (sergiuburlea37@gmail.com), exact ca
-- lista ADMIN_EMAILS din api/_lib/admin.js (folosita de admin.html/downloads,
-- neschimbat de aceasta migrare).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, member_id, lang, role)
  values(
    new.id,
    new.email,
    'TSB-' || upper(substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(new.raw_user_meta_data->>'lang', 'ro'),
    case when lower(new.email) = 'sergiuburlea37@gmail.com' then 'admin'::public.user_role else 'free'::public.user_role end
  );
  insert into public.subscriptions(user_id) values(new.id);
  return new;
end $$;

-- Daca ai creat deja contul de admin INAINTE sa rulezi acest script, ruleaza
-- si linia de mai jos ca sa-l promovezi retroactiv (nu strica nimic daca
-- rulezi comanda si daca profilul nu exista inca - pur si simplu nu modifica
-- niciun rand):
update public.profiles set role = 'admin' where lower(email) = 'sergiuburlea37@gmail.com';
