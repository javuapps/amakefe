-- Trigger functions have no business on the REST surface.
--
-- `sec_profile_matches_type()` and `usr_profile_is_reader()` are invoked by
-- triggers, which run as the table owner and need no grant at all — but every
-- function in `public` is published as an RPC by default, so both appeared in
-- the advisor as SECURITY DEFINER functions any anonymous caller could reach.
-- They take no arguments and would fail outside a trigger context, so nothing
-- was exploitable; an endpoint that exists only to error is still an endpoint
-- that should not exist.
revoke execute on function public.sec_profile_matches_type() from public, anon, authenticated;
revoke execute on function public.usr_profile_is_reader() from public, anon, authenticated;

-- The same was already true of the one the reader's sign-up hangs off.
revoke execute on function public.usr_handle_new_user() from public, anon, authenticated;
