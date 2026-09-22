-- Corrects 20260920100500. That migration revoked EXECUTE from `anon` and
-- `authenticated`, which achieved nothing: Postgres grants EXECUTE on every new
-- function to PUBLIC by default, and both roles inherit it. The revoke has to
-- name PUBLIC.
--
-- Trigger functions are unaffected by losing EXECUTE — the privilege is checked
-- when the trigger is created, not when it fires.

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.usr_handle_new_user() from public;
revoke execute on function public.com_sync_like_count() from public;

-- usr_is_staff is evaluated inside RLS policies, which run as the querying role,
-- so `authenticated` must keep it. `anon` never hits a policy that uses it.
revoke execute on function public.usr_is_staff() from public;
grant execute on function public.usr_is_staff() to authenticated;

-- Deliberately left callable by anon, and expected to stay on the advisor list:
--   cnt_story_is_public — the anon SELECT policy on cnt_story_parts evaluates it,
--     and it reveals only whether a story is already published.
--   cnt_search_stories  — the story search readers use, with no session.
--   sup_supporter_count — the public supporter total on the Support screen,
--     which is why it is definer: it counts rows no reader may select.
