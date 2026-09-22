-- Corrects 20260920100800, which was still incomplete.
--
-- That migration revoked EXECUTE from PUBLIC, having found that revoking from
-- `anon, authenticated` alone did nothing. Both conclusions were right and both
-- were partial: Supabase ships DEFAULT PRIVILEGES on the `public` schema that
-- grant EXECUTE on every newly created function to `anon`, `authenticated` and
-- `service_role` *explicitly*. Removing the PUBLIC grant leaves that explicit
-- `anon=X` grant untouched.
--
-- So a function is only closed to signed-out callers once it is revoked from
-- PUBLIC **and** from anon. `usr_is_staff` was the one function that happened to
-- get both, which is why it alone looked correct.
--
-- Everything is revoked here and then granted back deliberately, so the intent
-- is readable in one place instead of spread across six migrations.

revoke execute on all functions in schema public from public, anon;

-- Trigger and internal functions: callable by nobody through the API.
-- (Triggers fire regardless of EXECUTE; the privilege is checked at CREATE
-- TRIGGER time, not on each row.)
revoke execute on function public.set_updated_at()            from authenticated;
revoke execute on function public.usr_handle_new_user()       from authenticated;
revoke execute on function public.com_sync_like_count()       from authenticated;
revoke execute on function public.cnt_guard_publish()         from authenticated;
revoke execute on function public.cnt_lock_published_slug()   from authenticated;
revoke execute on function public.cnt_text_to_doc(text)       from authenticated;
revoke execute on function public.cnt_slugify(text)           from authenticated;

-- Editors write story parts, and the generated columns on that table evaluate
-- cnt_doc_text as the writing role.
grant execute on function public.cnt_doc_text(jsonb) to authenticated;

-- The studio.
grant execute on function public.usr_is_staff()      to authenticated;
grant execute on function public.usr_is_editorial()  to authenticated;
grant execute on function public.cnt_is_series(uuid) to authenticated;
grant execute on function public.cnt_dashboard_stats()               to authenticated;
grant execute on function public.cnt_story_performance(integer)      to authenticated;
grant execute on function public.cnt_series_retention(uuid)          to authenticated;
grant execute on function public.cnt_reorder_parts(uuid, uuid[])     to authenticated;
grant execute on function public.edt_consent_complete(uuid)          to authenticated;
grant execute on function public.edt_set_consent(uuid, text, boolean) to authenticated;
grant execute on function public.edt_set_interview_complete(uuid, boolean) to authenticated;
grant execute on function public.edt_story_record(uuid)              to authenticated;
grant execute on function public.edt_add_source(uuid, public.edt_source_kind, timestamptz, integer, text) to authenticated;
grant execute on function public.edt_publish_story(uuid)             to authenticated;
grant execute on function public.edt_create_story(text, text, text, text, public.cnt_source_type, smallint, uuid, text, text, public.edt_source_kind, timestamptz) to authenticated;

-- The reader, signed out. These three are the only functions a stranger with the
-- publishable key may call, and each is intentional:
--   cnt_story_is_public  — the anon SELECT policy on cnt_story_parts evaluates it
--   cnt_search_stories   — story search, which needs no account
--   sup_supporter_count  — the public supporter total on the Support screen
grant execute on function public.cnt_story_is_public(uuid)           to anon, authenticated;
grant execute on function public.cnt_search_stories(text, integer)   to anon, authenticated;
grant execute on function public.sup_supporter_count()               to anon, authenticated;

-- Stop the default privileges from re-granting anon on the next function added.
alter default privileges in schema public revoke execute on functions from anon;
