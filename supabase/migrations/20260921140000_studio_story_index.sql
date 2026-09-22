-- The studio's index of stories.
--
-- The list screen needs to search, filter and page, and all three have to happen
-- in the same place or none of them are right: filtering in the browser means
-- fetching every story to count them, and paging what you have already fetched
-- is not paging. So the shape the screen lists is a view, and PostgREST filters,
-- orders and ranges over it.
--
-- `status` is derived here rather than stored, for the same reason there is no
-- status column on the story: a story's state is a fact about its parts, and two
-- places to record it is one place to be wrong.

create view public.cnt_studio_stories
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.summary,
  s.story_type,
  s.planned_part_count,
  s.cover_image_path,
  s.created_at,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(p.part_count, 0)       as part_count,
  coalesce(p.live_count, 0)       as live_part_count,
  coalesce(p.scheduled_count, 0)  as scheduled_part_count,
  coalesce(p.word_count, 0)       as word_count,
  p.first_published_at,
  case
    when coalesce(p.live_count, 0) = 0 and coalesce(p.scheduled_count, 0) = 0 then 'draft'
    when coalesce(p.live_count, 0) = 0 then 'scheduled'
    -- "published" only once the series has run its planned length; until then it
    -- is still going out, which is a different thing to the creator.
    when p.live_count >= (case when s.story_type = 'single' then 1
                               else coalesce(s.planned_part_count, 1) end) then 'published'
    else 'publishing'
  end as status
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                                                              as part_count,
    count(*) filter (where sp.published_at is not null
                       and sp.published_at <= now())::int                      as live_count,
    count(*) filter (where sp.published_at > now())::int                       as scheduled_count,
    coalesce(sum(sp.word_count), 0)::int                                       as word_count,
    min(sp.published_at) filter (where sp.published_at <= now())               as first_published_at
  from public.cnt_story_parts sp
  where sp.story_id = s.id
) p on true
-- security_invoker means RLS on cnt_stories already applies, and that lets a
-- reader see published rows. They would come back with zeroed counts, since the
-- parts table is editorial-only — accurate but meaningless, and a surface with
-- no reason to exist. Staff only.
where public.usr_is_staff();

revoke all on public.cnt_studio_stories from anon;
grant select on public.cnt_studio_stories to authenticated;
