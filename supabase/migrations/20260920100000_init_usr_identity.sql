-- Identity foundation.
--
-- The audience prefers anonymity, so reading is never gated: published content is
-- readable by the `anon` role. Identity exists only to attach per-reader state
-- (bookmarks, progress, reactions, comments) and is obtained through Supabase
-- anonymous sign-in — no phone number, no email, no login screen. The same
-- auth.uid() can later be upgraded to phone/email for cross-device sync without
-- introducing a second auth path.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- usr_ — reader identity
-- ---------------------------------------------------------------------------

create type public.usr_role as enum (
  'member',
  'creator',
  'editor',
  'moderator',
  'admin',
  'finance',
  'super_admin'
);

create table public.usr_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint usr_profiles_display_name_len check (
    display_name is null or char_length(btrim(display_name)) between 2 and 40
  )
);

create trigger usr_profiles_set_updated_at
  before update on public.usr_profiles
  for each row execute function public.set_updated_at();

create table public.usr_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.usr_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Every auth user — anonymous or not — gets a profile row.
create or replace function public.usr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usr_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger usr_on_auth_user_created
  after insert on auth.users
  for each row execute function public.usr_handle_new_user();

-- Staff check for editorial/moderation policies. security definer so that reading
-- usr_roles inside a policy does not recurse through usr_roles' own RLS.
create or replace function public.usr_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usr_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('creator', 'editor', 'moderator', 'admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.usr_profiles enable row level security;
alter table public.usr_roles    enable row level security;

-- A display name is shown next to comments, so profiles are publicly readable.
-- The table deliberately holds nothing else identifying.
create policy usr_profiles_read_all
  on public.usr_profiles for select
  to anon, authenticated
  using (true);

create policy usr_profiles_write_own
  on public.usr_profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy usr_roles_read_own
  on public.usr_roles for select
  to authenticated
  using (user_id = (select auth.uid()) or public.usr_is_staff());
