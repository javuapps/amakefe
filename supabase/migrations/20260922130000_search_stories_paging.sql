-- Search pages in SQL, not over HTTP.
--
-- The reader's story list loads as it is scrolled, so search has to page too.
-- The obvious route — supabase-js `.range()` on the RPC — does not work: that
-- sets a `Range` header, and PostgREST ignores it for a POST to a function.
-- Proved against the live API, where `Range: 1-1` returned the whole result set
-- and `?limit=1&offset=1` returned the second row alone.
--
-- Relying on a query string that supabase-js has no method for would be worse
-- than either: it would work until someone wrote the call the ordinary way. So
-- the offset becomes an argument, beside the limit that was already one.
--
-- Adding a parameter changes the signature, which `create or replace` cannot
-- do, hence the drop. Existing callers pass p_query alone and are unaffected.

drop function if exists public.cnt_search_stories(text, int);

create function public.cnt_search_stories(
  p_query  text,
  p_limit  int default 30,
  p_offset int default 0
)
returns setof public.cnt_story_cards
language sql
stable
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('english', p_query) as ts)
  select card.*
  from public.cnt_story_cards card
  where exists (
    select 1 from public.cnt_stories s, q
    where s.id = card.id and s.search @@ q.ts
  )
  or exists (
    -- cnt_public_parts, never cnt_story_parts: the part's search vector is built
    -- from redacted text, so a hidden name cannot be used to find the story.
    select 1 from public.cnt_public_parts sp, q
    where sp.story_id = card.id and sp.search @@ q.ts
  )
  order by card.published_at desc
  limit least(p_limit, 100)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.cnt_search_stories(text, int, int) from public;
grant execute on function public.cnt_search_stories(text, int, int) to anon, authenticated;
