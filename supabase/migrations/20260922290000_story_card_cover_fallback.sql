-- A story's picture, for a list that has no part in front of it.
--
-- The reader's story page already falls back `part.thumbnail_path ??
-- story.cover_image_path`, because there it is reading one part. A list row has
-- no part to prefer, so it had only the story's own cover — and a story whose
-- parts carry pictures but whose cover was never set showed a lettered tile in
-- the list and a photograph on the page. Two answers to "what does this story
-- look like".
--
-- `cover_path` completes the same chain from the other end: the story's cover,
-- else the earliest published part's thumbnail. The lettered tile stays for a
-- story with neither, which is what makes it worth keeping rather than a
-- placeholder nobody meant.
--
-- It rides the lateral that is already scanning the published parts, so it
-- costs no extra pass. Appended, because `create or replace view` may only add
-- columns at the end.
create or replace view public.cnt_story_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.summary,
  s.story_type,
  s.cover_image_path,
  s.like_count,
  c.slug as category_slug,
  c.name as category_name,
  p.first_published_at as published_at,
  coalesce(p.published_part_count, 0) as part_count,
  case
    when s.story_type = 'single' then 1
    else greatest(coalesce(s.planned_part_count, 0), coalesce(p.published_part_count, 0))
  end as total_part_count,
  greatest(coalesce(p.read_minutes, 0), 1) as read_minutes,
  (select count(*)
     from public.com_comments cc
    where cc.story_id = s.id and cc.status = 'visible')::int as comment_count,
  coalesce(s.cover_image_path, p.first_thumbnail_path) as cover_path
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                          as published_part_count,
    min(sp.published_at)                   as first_published_at,
    coalesce(sum(sp.read_minutes), 0)::int as read_minutes,
    -- The earliest published part that actually has one, which is the story's
    -- opening image rather than whichever part happens to sort first.
    (select sp2.thumbnail_path
       from public.cnt_public_parts sp2
      where sp2.story_id = s.id and sp2.thumbnail_path is not null
      order by sp2.part_number
      limit 1)                             as first_thumbnail_path
  from public.cnt_public_parts sp
  where sp.story_id = s.id
) p on true;
