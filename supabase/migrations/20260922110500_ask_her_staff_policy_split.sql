-- Staff read any profile — as a separate policy, and here is why.
--
-- 20260922110000 tried the obvious thing: add `or public.usr_is_staff()` to the
-- existing policy on usr_profiles. That broke reading for signed-out visitors.
-- EXECUTE on that function was revoked from `anon` in 20260920101500 to keep it
-- off the REST surface, so instead of returning rows the policy raised
--
--   42501: permission denied for function usr_is_staff
--
-- for every anonymous reader. Granting it back would reopen an endpoint that
-- was closed deliberately, and Postgres gives no ordering guarantee that would
-- let the staff branch go unevaluated for a caller who cannot run it.
--
-- Permissive policies OR together and each is scoped to its own roles, so a
-- second policy limited to `authenticated` is simply never evaluated for
-- `anon`. No new grant, and the REST surface is exactly as it was.
--
-- It does not widen what readers see: usr_is_staff() is false for all of them,
-- and the published answer stays anonymous either way. She knows who asked; the
-- page still does not.

drop policy if exists usr_profiles_read_published on public.usr_profiles;

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

create policy usr_profiles_read_staff
  on public.usr_profiles for select
  to authenticated
  using (public.usr_is_staff());
