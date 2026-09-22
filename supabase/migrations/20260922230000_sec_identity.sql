-- One identity table, one profile per kind of account.
--
-- Adopted from ginni, which learned it the way this project would have: with an
-- identity spread across a credential store and whatever each surface happened
-- to record, and no single answer to "which application does this account
-- belong to". Ginni's `sec_users` is the root of its identity graph and every
-- profile table hangs off it; this is the same shape, with one difference that
-- matters.
--
-- **Supabase Auth owns the credential, so `sec_users` does not.** Ginni stores
-- an Argon2id hash and mints its own sessions, and can therefore refuse a
-- sign-in outright when the account belongs to another surface — its `Expect`
-- parameter, checked in the lookup so a wrong-surface credential is
-- indistinguishable from one that does not exist. Here the password and the
-- emailed code live in `auth.users` and the session is minted before this
-- schema is consulted at all.
--
-- So the surface check moves from *before* the session to *behind every row*:
-- `sec_is_reader()`, `sec_is_editorial()` and `sec_is_operator()` are what the
-- policies consult, and an account of the wrong type reads nothing whatever its
-- token says. The apps check too, and sign the person out with a message that
-- names no other application — but that is a courtesy to whoever is looking at
-- the screen, exactly as the role gate always was. RLS is the enforcement.
--
--     auth.users              the credential: password, or the emailed code
--         │ 1:1
--     sec_users               who they are, and WHICH APPLICATION they belong to
--         │ 1:1, matching the type
--         ├── usr_profiles    a reader   (usr_ already means reader here)
--         ├── edt_editors     an editor  — the studio
--         └── opr_operators   an operator — the console
--
-- `user_type` says which application; `usr_roles` says what they may do inside
-- it. Two questions, two columns — the same split ginni makes between a
-- user_type and a school seat. One account has exactly one type: an editor who
-- also needs to settle payouts gets a second account, because the separation
-- between the party being paid and the party recording the payout is the whole
-- reason the console is a separate application.

create type public.sec_user_type as enum ('reader', 'editorial', 'operator');
create type public.sec_user_status as enum ('active', 'suspended');

create table public.sec_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  user_type  public.sec_user_type not null,
  -- Nullable, unlike ginni's. Ginni's users all arrive through a registration
  -- form that collects a name; a reader here arrives from a Facebook post with
  -- nothing but an email address, and `usr_profiles.display_name` is the name
  -- they choose later. A placeholder would be a name that is not theirs.
  full_name  text,
  -- Contact, never a credential — `auth.users` decides who may sign in. Not
  -- unique for the same reason ginni's email is not: a household, or a couple,
  -- may share one number.
  mobile     text,
  status     public.sec_user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sec_users_mobile_shape check (mobile is null or mobile ~ '^\+[1-9][0-9]{7,14}$')
);

comment on column public.sec_users.mobile is
  'E.164 contact number. Never used for authentication — auth.users owns the credential.';

create index sec_users_by_type on public.sec_users (user_type) where status = 'active';

create trigger sec_users_set_updated_at
  before update on public.sec_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill, before anything references these rows
--
-- This has to run before usr_profiles gains its foreign key and before the
-- profile guards exist: every account alive today needs a sec_users row first,
-- or the constraint below has nothing to point at.
-- ---------------------------------------------------------------------------

-- Everyone who already has an editorial role is an editor; everyone else is a
-- reader. That is exactly what was true before this migration, written down.
insert into public.sec_users (id, user_type, created_at)
select u.id,
       case
         when exists (
           select 1 from public.usr_roles r
           where r.user_id = u.id
             and r.role in ('creator', 'editor', 'admin', 'super_admin')
         ) then 'editorial'::public.sec_user_type
         else 'reader'::public.sec_user_type
       end,
       u.created_at
from auth.users u
on conflict (id) do nothing;

-- An editorial account that came from the old model has no name recorded
-- anywhere, so it gets a profile only once someone says what it is. The
-- reader rows in usr_profiles are already correct.
delete from public.usr_profiles p
where exists (select 1 from public.sec_users s where s.id = p.id and s.user_type <> 'reader');


-- ---------------------------------------------------------------------------
-- The profile tables
-- ---------------------------------------------------------------------------

-- `usr_profiles` is already the reader's profile — display_name, avatar, and
-- the anonymity policy that decides who may see it — so it is not renamed, only
-- given its parent. The `usr_` prefix has meant "reader identity and state"
-- since the schema was laid out.
alter table public.usr_profiles
  add constraint usr_profiles_user
  foreign key (id) references public.sec_users (id) on delete cascade;

create table public.edt_editors (
  user_id    uuid primary key references public.sec_users (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name  text not null check (length(btrim(last_name)) > 0),
  created_at timestamptz not null default now()
);

create table public.opr_operators (
  user_id    uuid primary key references public.sec_users (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name  text not null check (length(btrim(last_name)) > 0),
  created_at timestamptz not null default now()
);

-- A profile row must match its user's type. Postgres cannot say that in a
-- check constraint — it spans two tables — and ginni enforces the equivalent in
-- Go, inside CreateUser. Here there is no single writer to trust, so it is a
-- trigger: an editor's row under an operator account would make the surface
-- gates disagree about which application the account belongs to.
create or replace function public.sec_profile_matches_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected public.sec_user_type := tg_argv[0]::public.sec_user_type;
  v_actual   public.sec_user_type;
begin
  select user_type into v_actual from public.sec_users where id = new.user_id;
  if v_actual is null then
    raise exception 'no sec_users row for %', new.user_id;
  end if;
  if v_actual <> v_expected then
    raise exception '% is a % account, so it cannot have a % profile',
      new.user_id, v_actual, v_expected;
  end if;
  return new;
end;
$$;

create trigger edt_editors_type_matches
  before insert or update on public.edt_editors
  for each row execute function public.sec_profile_matches_type('editorial');

create trigger opr_operators_type_matches
  before insert or update on public.opr_operators
  for each row execute function public.sec_profile_matches_type('operator');

-- usr_profiles takes the same guard, but keyed on `id` rather than `user_id`,
-- so it gets its own one-line function rather than a parameterised shared one
-- that would need to know which column to read.
create or replace function public.usr_profile_is_reader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select user_type from public.sec_users where id = new.id) <> 'reader' then
    raise exception '% is not a reader account', new.id;
  end if;
  return new;
end;
$$;

create trigger usr_profiles_type_matches
  before insert or update on public.usr_profiles
  for each row execute function public.usr_profile_is_reader();

-- ---------------------------------------------------------------------------
-- Which application does this session belong to
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER for the usual reason: a policy that reads sec_users must not
-- recurse into sec_users' own RLS.
create or replace function public.sec_user_type()
returns public.sec_user_type
language sql
stable
security definer
set search_path = ''
as $$
  select user_type from public.sec_users
  where id = (select auth.uid()) and status = 'active';
$$;

create or replace function public.sec_is_reader()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.sec_user_type() = 'reader'; $$;

create or replace function public.sec_is_editorial()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.sec_user_type() = 'editorial'; $$;

create or replace function public.sec_is_operator()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.sec_user_type() = 'operator'; $$;

revoke execute on function public.sec_user_type() from public, anon;
revoke execute on function public.sec_is_reader() from public, anon;
revoke execute on function public.sec_is_editorial() from public, anon;
revoke execute on function public.sec_is_operator() from public, anon;
grant execute on function public.sec_user_type() to authenticated;
grant execute on function public.sec_is_reader() to authenticated;
grant execute on function public.sec_is_editorial() to authenticated;
grant execute on function public.sec_is_operator() to authenticated;

-- ---------------------------------------------------------------------------
-- The role gates now ask both questions
-- ---------------------------------------------------------------------------

-- Before this, a role was the whole answer, so an account granted `finance`
-- could open the studio's data and an `editor` could reach the console's. The
-- type is now the first half of every gate: what application you belong to,
-- then what you may do inside it.
create or replace function public.usr_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.sec_user_type() = 'editorial'
     and exists (
       select 1 from public.usr_roles r
       where r.user_id = (select auth.uid())
         and r.role in ('creator', 'editor', 'admin', 'super_admin', 'moderator')
     );
$$;

create or replace function public.usr_is_editorial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.sec_user_type() = 'editorial'
     and exists (
       select 1 from public.usr_roles r
       where r.user_id = (select auth.uid())
         and r.role in ('creator', 'editor', 'admin', 'super_admin')
     );
$$;

-- `super_admin` is deliberately NOT an operator any more. The party being paid
-- must not be the party recording the payout, and an account that can do both
-- makes that guarantee a matter of who is logged in. Someone who needs both
-- gets two accounts.
create or replace function public.usr_is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.sec_user_type() = 'operator'
     and exists (
       select 1 from public.usr_roles r
       where r.user_id = (select auth.uid()) and r.role = 'finance'
     );
$$;

-- ---------------------------------------------------------------------------
-- New accounts
-- ---------------------------------------------------------------------------

-- Self-registration is always a reader: the studio and the console have no
-- sign-up, and an account that arrives through Supabase Auth on its own got
-- there through the reader's emailed code.
create or replace function public.usr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sec_users (id, user_type)
  values (new.id, 'reader')
  on conflict (id) do nothing;

  insert into public.usr_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

/**
 * Turns a freshly created account into an editor or an operator.
 *
 * Studio and console accounts are made by an administrator in the Supabase
 * dashboard, which can only create the credential — it knows nothing about
 * user types, profiles or roles. Doing those three by hand is how one of them
 * gets forgotten, and a half-provisioned account fails in a way that looks like
 * a bug in the app. This does all of it, or none of it.
 */
create or replace function public.sec_provision_account(
  p_email text,
  p_type public.sec_user_type,
  p_first_name text,
  p_last_name text,
  p_role public.usr_role,
  p_mobile text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.usr_roles
    where user_id = (select auth.uid()) and role = 'super_admin'
  ) then
    raise exception 'not permitted';
  end if;

  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'no account for %: create it in Authentication -> Users first', p_email;
  end if;

  -- The reader rows the sign-up trigger made are wrong for this account, and
  -- the profile guard would refuse the new one while they stand.
  delete from public.usr_profiles where id = v_id;

  insert into public.sec_users (id, user_type, full_name, mobile)
  values (v_id, p_type, btrim(p_first_name) || ' ' || btrim(p_last_name), p_mobile)
  on conflict (id) do update
    set user_type = excluded.user_type,
        full_name = excluded.full_name,
        mobile    = coalesce(excluded.mobile, public.sec_users.mobile);

  if p_type = 'editorial' then
    insert into public.edt_editors (user_id, first_name, last_name)
    values (v_id, btrim(p_first_name), btrim(p_last_name))
    on conflict (user_id) do update
      set first_name = excluded.first_name, last_name = excluded.last_name;
  elsif p_type = 'operator' then
    insert into public.opr_operators (user_id, first_name, last_name)
    values (v_id, btrim(p_first_name), btrim(p_last_name))
    on conflict (user_id) do update
      set first_name = excluded.first_name, last_name = excluded.last_name;
  else
    insert into public.usr_profiles (id) values (v_id) on conflict (id) do nothing;
  end if;

  -- One type, one role set: a leftover grant from a previous type is exactly
  -- the cross-surface access this migration exists to close.
  delete from public.usr_roles where user_id = v_id;
  if p_role is not null then
    insert into public.usr_roles (user_id, role) values (v_id, p_role);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.sec_provision_account(text, public.sec_user_type, text, text, public.usr_role, text)
  from public, anon;
grant execute on function public.sec_provision_account(text, public.sec_user_type, text, text, public.usr_role, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Who may read what
-- ---------------------------------------------------------------------------

alter table public.sec_users     enable row level security;
alter table public.edt_editors   enable row level security;
alter table public.opr_operators enable row level security;

-- Your own row, and nothing else. `sec_users` is a directory of every account
-- on the platform, which is not something any surface needs to read — the apps
-- ask "am I the right kind of user", which is what the functions above answer
-- without returning anyone else's row.
create policy sec_users_read_own
  on public.sec_users for select to authenticated
  using (id = (select auth.uid()));

create policy edt_editors_read_own
  on public.edt_editors for select to authenticated
  using (user_id = (select auth.uid()));

create policy opr_operators_read_own
  on public.opr_operators for select to authenticated
  using (user_id = (select auth.uid()));

-- Nobody updates their own type, role or status from a client. Provisioning is
-- sec_provision_account, which checks for super_admin; suspension is an
-- administrator's act in the dashboard.
