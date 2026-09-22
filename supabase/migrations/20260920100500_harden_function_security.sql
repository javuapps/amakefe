-- Function hardening, prompted by the Supabase security advisors.
--
-- 1. set_updated_at ran with a mutable search_path.
-- 2. Every function in `public` is exposed as a REST RPC endpoint. Trigger
--    functions and the staff check have no business being callable that way.
--
-- cnt_story_is_public stays callable by anon on purpose: the anon SELECT policy on
-- cnt_story_parts evaluates it, and it discloses nothing beyond whether a story is
-- already published.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at()        from anon, authenticated;
revoke execute on function public.usr_handle_new_user()   from anon, authenticated;
revoke execute on function public.com_sync_like_count()   from anon, authenticated;
revoke execute on function public.usr_is_staff()          from anon;
