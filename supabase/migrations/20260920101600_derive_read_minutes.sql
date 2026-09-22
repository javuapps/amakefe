-- read_minutes was a column the client had to remember to set, and nothing did,
-- so every newly written part reported "0 min read".
--
-- It is a pure function of the text, so the database derives it — one less thing
-- for an editor to get wrong, and it can never drift from the body.
--
-- The view and the search function have to be dropped and rebuilt because
-- cnt_search_stories returns `setof cnt_story_cards`.

drop function if exists public.cnt_search_stories(text, integer);
drop view if exists public.cnt_story_cards;

alter table public.cnt_story_parts
  drop column read_minutes,
  add column read_minutes integer
    generated always as (
      greatest(
        1,
        round(
          coalesce(array_length(regexp_split_to_array(btrim(public.cnt_doc_text(body)), '\s+'), 1), 0)
          / 200.0
        )::integer
      )
    ) stored;

create view public.cnt_story_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.summary,
  s.author_alias,
  s.source_type,
  s.cover_image_path,
  s.published_at,
  s.like_count,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(p.published_part_count, 0)  as part_count,
  coalesce(s.planned_part_count, p.published_part_count, 0) as total_part_count,
  coalesce(p.read_minutes, 0) as read_minutes
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int as published_part_count,
    coalesce(sum(sp.read_minutes), 0)::int as read_minutes
  from public.cnt_story_parts sp
  where sp.story_id = s.id
    and sp.published_at is not null
    and sp.published_at <= now()
) p on true;

create or replace function public.cnt_search_stories(p_query text, p_limit int default 30)
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
    select 1 from public.cnt_story_parts sp, q
    where sp.story_id = card.id
      and sp.published_at <= now()
      and sp.search @@ q.ts
  )
  order by card.published_at desc
  limit least(p_limit, 100);
$$;

revoke execute on function public.cnt_search_stories(text, integer) from public, anon;
grant execute on function public.cnt_search_stories(text, integer) to anon, authenticated;
