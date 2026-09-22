-- Counting reads without counting readers.
--
-- Reactions and comments were already recorded — `com_reactions` feeds
-- `cnt_stories.like_count`, and `com_comments` is its own table. Reads were not.
-- `usr_read_progress` looks like read tracking but is not: an identity only
-- exists once a reader saves or reacts, so it counts the engaged and misses
-- everyone who simply read the story, which is nearly all of them.
--
-- The obvious fix — a row per view with a user id — is the one thing this
-- product must not build. A view log keyed to readers is a record of who read
-- which story about whose marriage. So this table has no identity column at
-- all, and cannot grow one without a migration someone has to justify: it is a
-- daily counter per part, incremented in place. There is nothing in it to leak.

create table public.cnt_story_views (
  story_id    uuid     not null references public.cnt_stories (id) on delete cascade,
  part_number smallint not null,
  viewed_on   date     not null,
  views       integer  not null default 0,
  primary key (story_id, part_number, viewed_on)
);

alter table public.cnt_story_views enable row level security;

-- Readers write only through the RPC below, and never read this back.
create policy cnt_story_views_staff_read
  on public.cnt_story_views for select to authenticated
  using (public.usr_is_staff());

create index cnt_story_views_recent_idx
  on public.cnt_story_views (viewed_on desc, story_id);

/**
 * Records one read of a published part.
 *
 * SECURITY DEFINER because the table is closed to everyone: the only way in is
 * this function, which refuses anything that is not actually published, so the
 * counter cannot be used to probe for drafts.
 */
create or replace function public.cnt_record_view(p_story_id uuid, p_part_number smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cnt_story_parts p
    where p.story_id = p_story_id
      and p.part_number = p_part_number
      and p.published_at is not null
      and p.published_at <= now()
  ) then
    return;
  end if;

  insert into public.cnt_story_views (story_id, part_number, viewed_on, views)
  values (p_story_id, p_part_number, (now() at time zone 'utc')::date, 1)
  on conflict (story_id, part_number, viewed_on)
  do update set views = public.cnt_story_views.views + 1;
end;
$$;

revoke execute on function public.cnt_record_view(uuid, smallint) from public;
grant execute on function public.cnt_record_view(uuid, smallint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the studio's index shows
-- ---------------------------------------------------------------------------

-- Appended to the end, which is all `create or replace view` allows.
create or replace view public.cnt_studio_stories
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
    when p.live_count >= (case when s.story_type = 'single' then 1
                               else coalesce(s.planned_part_count, 1) end) then 'published'
    else 'publishing'
  end as status,
  coalesce(v.views, 0)      as view_count,
  coalesce(v.views_7d, 0)   as view_count_7d,
  coalesce(s.like_count, 0) as reaction_count,
  coalesce(m.comments, 0)   as comment_count
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                                                as part_count,
    count(*) filter (where sp.published_at is not null
                       and sp.published_at <= now())::int        as live_count,
    count(*) filter (where sp.published_at > now())::int         as scheduled_count,
    coalesce(sum(sp.word_count), 0)::int                         as word_count,
    min(sp.published_at) filter (where sp.published_at <= now()) as first_published_at
  from public.cnt_story_parts sp
  where sp.story_id = s.id
) p on true
left join lateral (
  select
    coalesce(sum(sv.views), 0)::int as views,
    coalesce(sum(sv.views) filter (
      where sv.viewed_on > (now() at time zone 'utc')::date - 7), 0)::int as views_7d
  from public.cnt_story_views sv
  where sv.story_id = s.id
) v on true
left join lateral (
  select count(*)::int as comments
  from public.com_comments cm
  where cm.story_id = s.id and cm.status = 'visible'
) m on true
where public.usr_is_staff();

-- ---------------------------------------------------------------------------
-- The numbers above the list
-- ---------------------------------------------------------------------------

create or replace function public.cnt_studio_totals()
returns table (
  stories integer,
  published integer,
  drafts integer,
  views integer,
  views_7d integer,
  reactions integer,
  comments integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.cnt_stories)::int,
    (select count(*) from public.cnt_studio_stories where status in ('published', 'publishing'))::int,
    (select count(*) from public.cnt_studio_stories where status = 'draft')::int,
    (select coalesce(sum(views), 0) from public.cnt_story_views)::int,
    (select coalesce(sum(views), 0) from public.cnt_story_views
      where viewed_on > (now() at time zone 'utc')::date - 7)::int,
    (select coalesce(sum(like_count), 0) from public.cnt_stories)::int,
    (select count(*) from public.com_comments where status = 'visible')::int
  where public.usr_is_staff();
$$;

revoke execute on function public.cnt_studio_totals() from public, anon;
grant execute on function public.cnt_studio_totals() to authenticated;
