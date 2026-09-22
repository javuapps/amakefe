-- Disconnecting the Page failed with `21000: DELETE requires a WHERE clause`.
--
-- Supabase runs the `safeupdate` guard, which refuses an unqualified DELETE or
-- UPDATE — a good rule that this function was simply on the wrong side of.
-- SECURITY DEFINER does not exempt it: the guard is set on the session, and the
-- session belongs to the `authenticated` role that called in.
--
-- The Edge Functions had already met this and worked around it with
-- `.neq('id', crypto.randomUUID())`, which is the same idea wearing a disguise.
-- Here the honest form is available, so it is used.
--
-- Deleting every row is the intent: there is one connection for the platform,
-- and disconnecting means there is none.

create or replace function public.cnt_facebook_disconnect()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then raise exception 'not permitted'; end if;
  delete from public.cnt_facebook_connection where true;
end;
$$;

revoke execute on function public.cnt_facebook_disconnect() from public, anon;
grant execute on function public.cnt_facebook_disconnect() to authenticated;
