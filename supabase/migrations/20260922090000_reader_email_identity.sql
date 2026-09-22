-- Readers sign in with an emailed code, not with Facebook.
--
-- Facebook's review of a consumer login app takes time the project does not
-- have, so reader sign-in becomes email plus a one-time code. The author's
-- Facebook app is untouched: she still connects her Page and posts to it.
--
-- What this costs, and what replaces it:
--
--   An email address carries no name and no picture. The profile was being
--   filled from Facebook's metadata by a trigger; there is now nothing to fill
--   it from, so `display_name` goes back to being something the reader chooses
--   and `avatar_url` goes away entirely rather than sitting unused. A reader's
--   avatar is the initial of their name again, which is what it was before.
--
-- The rule is unchanged and so is the policy that enforces it: identity is
-- recorded at submission, anonymity applies at publication, and a profile is
-- visible only once its owner has published something under it.

alter table public.usr_profiles drop column avatar_url;

-- Back to what it was: a row per auth user, and nothing assumed about where
-- they came from.
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

-- These existed only to read Facebook's metadata off auth.users.
drop trigger if exists usr_on_auth_user_identity_changed on auth.users;
drop function if exists public.usr_sync_profile_identity();
drop function if exists public.usr_profile_name(jsonb);
drop function if exists public.usr_profile_avatar(jsonb);
