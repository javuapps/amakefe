-- An empty part reported one word, not zero.
--
-- `regexp_split_to_array('', '\s+')` returns `{""}` — an array of length 1 — so
-- word_count was 1 for a part with nothing in it, read_minutes rounded up to 1,
-- and the "Part 1 is empty" guard in edt_publish_story never fired.
--
-- The guard looked tested: the harness asserted that publishing an empty part
-- was refused, and it was — but by the *consent* gate, which was also failing at
-- that moment. Two gates raising the same errcode hid this one being dead.

create or replace function public.cnt_word_count(doc jsonb)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when btrim(coalesce(public.cnt_doc_text(doc), '')) = '' then 0
    else coalesce(
      array_length(regexp_split_to_array(btrim(public.cnt_doc_text(doc)), '\s+'), 1),
      0)
  end;
$$;

revoke execute on function public.cnt_word_count(jsonb) from public, anon;
grant execute on function public.cnt_word_count(jsonb) to authenticated;

-- read_minutes lives in the view, so both it and word_count come down together.
drop function if exists public.cnt_search_stories(text, integer);
drop view if exists public.cnt_story_cards;

alter table public.cnt_story_parts
  drop column word_count,
  drop column read_minutes,
  add column word_count integer
    generated always as (public.cnt_word_count(body)) stored,
  add column read_minutes integer
    generated always as (
      case when public.cnt_word_count(body) = 0
           then 0
           else greatest(1, round(public.cnt_word_count(body) / 200.0)::integer)
      end
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
  greatest(coalesce(p.read_minutes, 0), 1) as read_minutes
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
