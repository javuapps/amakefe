-- Readers sign in with Facebook.
--
-- The rule this migration implements:
--
--   Identity is always recorded at submission. Anonymity is a property of
--   publication, applied only where it is required.
--
-- Submitting was never anonymous — every insert policy already forces
-- `user_id = auth.uid()`. What changes is that the uid now belongs to a named
-- person rather than to a browser, and that the profile carries their Facebook
-- name and picture so comments and Community answers can be published under it.
--
-- Contributor anonymity is untouched and is a different, harder boundary: real
-- names live in cnt_story_parts.body, that table is closed to `anon`, and
-- cnt_public_parts redacts every published field. Nothing here goes near it.
--
-- cnt_story_views is also untouched. It stays an identity-free daily counter so
-- that reading still counts for someone who never signs in. Its own header says
-- a per-reader view log is "the one thing this product must not build"; that was
-- written when readers were anonymous by policy. Per-reader history now exists
-- openly in usr_read_progress, and the counter stays identity-free because it
-- must keep working for signed-out readers, not because of what it would reveal.

-- ---------------------------------------------------------------------------
-- The profile carries a real name and picture
-- ---------------------------------------------------------------------------

-- It holds a Facebook URL. Every other `_path` column in this schema means a
-- path inside `public_media`, and reading this one as a storage path would send
-- someone looking for a file that was never uploaded.
alter table public.usr_profiles rename column avatar_path to avatar_url;

/**
 * A display name from an identity provider's metadata, or null.
 *
 * `usr_profiles_display_name_len` requires 2 to 40 characters, and Facebook
 * names longer than 40 exist. This runs inside a trigger on `auth.users`, so a
 * constraint violation would not merely skip the profile — it would fail the
 * sign-up itself. Long names are cut, and anything left too short becomes null
 * rather than an error.
 */
create or replace function public.usr_profile_name(p_meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when char_length(trimmed) between 2 and 40 then trimmed
           else null
         end
  from (
    select btrim(left(btrim(coalesce(p_meta ->> 'full_name', p_meta ->> 'name')), 40)) as trimmed
  ) s;
$$;

create or replace function public.usr_profile_avatar(p_meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(coalesce(p_meta ->> 'avatar_url', p_meta ->> 'picture')), '');
$$;

-- Every auth user gets a profile row, now with whatever the provider told us.
create or replace function public.usr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usr_profiles (id, display_name, avatar_url)
  values (
    new.id,
    public.usr_profile_name(new.raw_user_meta_data),
    public.usr_profile_avatar(new.raw_user_meta_data)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

/**
 * Signing in with Facebook on top of an existing session does not insert a row
 * into auth.users — `linkIdentity` updates the one that is already there. An
 * insert-only trigger therefore never fires for an upgraded reader, and their
 * profile would stay blank while their comments went out unnamed.
 *
 * What is already on the profile wins: a name the reader has since changed is
 * not overwritten by Facebook's on every token refresh.
 */
create or replace function public.usr_sync_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.usr_profiles
     set display_name = coalesce(display_name, public.usr_profile_name(new.raw_user_meta_data)),
         avatar_url   = coalesce(avatar_url, public.usr_profile_avatar(new.raw_user_meta_data))
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists usr_on_auth_user_identity_changed on auth.users;
create trigger usr_on_auth_user_identity_changed
  after update of raw_user_meta_data on auth.users
  for each row
  when (new.raw_user_meta_data is distinct from old.raw_user_meta_data)
  execute function public.usr_sync_profile_identity();

revoke execute on function public.usr_profile_name(jsonb) from public, anon, authenticated;
revoke execute on function public.usr_profile_avatar(jsonb) from public, anon, authenticated;
revoke execute on function public.usr_sync_profile_identity() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A profile is visible once its owner has published under it
-- ---------------------------------------------------------------------------

/**
 * `usr_profiles_read_all` used `using (true)`, which was harmless while
 * display_name was a pseudonym that defaulted to null. Holding real names and
 * pictures, it would hand the entire reader list — name, picture, join date —
 * to anyone with the publishable key, which ships inside the client and is
 * therefore public. That includes people who have only ever read.
 *
 * So the policy becomes the publication rule itself: you are visible when you
 * have published something under your name, and to yourself always.
 *
 * `com_ask_questions` is deliberately absent. A question to Amake Fe is
 * published anonymously, so having asked one must not make its author findable
 * — that is what "anonymous at publication" means, expressed once here rather
 * than in every screen that might forget.
 *
 * The EXISTS clauses run as the caller, so they are themselves filtered by each
 * table's own SELECT policy: `anon` sees only visible comments on public
 * stories, which is exactly the set that should expose an author.
 */
drop policy if exists usr_profiles_read_all on public.usr_profiles;

create policy usr_profiles_read_published
  on public.usr_profiles for select
  to anon, authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.com_comments c
      where c.user_id = public.usr_profiles.id and c.status = 'visible'
    )
    or exists (
      select 1 from public.com_answers a
      where a.user_id = public.usr_profiles.id and a.status = 'visible'
    )
    or exists (
      select 1 from public.com_questions q
      where q.user_id = public.usr_profiles.id and q.status = 'visible'
    )
  );

-- The policy runs per row, and none of these columns were indexed.
create index if not exists com_comments_user_idx  on public.com_comments (user_id);
create index if not exists com_answers_user_idx   on public.com_answers (user_id);
create index if not exists com_questions_user_idx on public.com_questions (user_id);
