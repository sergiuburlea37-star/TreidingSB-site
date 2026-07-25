-- Run with `supabase db push` or paste once into Supabase SQL Editor.
create type public.user_role as enum ('free', 'member', 'admin');
create type public.subscription_state as enum ('inactive', 'active', 'cancelled', 'past_due');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  member_id text not null unique,
  lang text not null default 'ro' check (lang in ('ro','en','ru','uk','pl')),
  role public.user_role not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status public.subscription_state not null default 'inactive',
  expires_at timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trading_ideas (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  side text not null check (side in ('BUY','SELL')),
  entry text not null,
  stop_loss text not null,
  take_profit text not null,
  risk_text text,
  note text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  report_date date not null,
  lang text not null check (lang in ('ro','en','ru','uk','pl')),
  file_path text not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.has_active_subscription()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = auth.uid() and p.role = 'member'
      and s.status = 'active' and s.expires_at > now()
  ) or public.is_admin()
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.has_active_subscription() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_active_subscription() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, member_id, lang)
  values(new.id, new.email, 'TSB-' || upper(substr(replace(new.id::text, '-', ''), 1, 10)), coalesce(new.raw_user_meta_data->>'lang', 'ro'));
  insert into public.subscriptions(user_id) values(new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.trading_ideas enable row level security;
alter table public.reports enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update(lang) on public.profiles to authenticated;

create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy subscriptions_admin_all on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy ideas_active_read on public.trading_ideas for select to authenticated using (published and public.has_active_subscription());
create policy ideas_admin_all on public.trading_ideas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reports_active_read on public.reports for select to authenticated using (published and public.has_active_subscription());
create policy reports_admin_all on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('reports-private', 'reports-private', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false;

create policy report_files_active_read on storage.objects for select to authenticated
using (bucket_id = 'reports-private' and public.has_active_subscription());
create policy report_files_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'reports-private' and public.is_admin());
create policy report_files_admin_update on storage.objects for update to authenticated
using (bucket_id = 'reports-private' and public.is_admin()) with check (bucket_id = 'reports-private' and public.is_admin());
create policy report_files_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'reports-private' and public.is_admin());

grant select on public.profiles, public.subscriptions, public.trading_ideas, public.reports to authenticated;
grant insert, update, delete on public.trading_ideas, public.reports to authenticated;
grant insert, update, delete on public.subscriptions to authenticated;
