-- No byline.
--
-- Every story on this platform is written by Amake Fe, from something someone
-- told her. Readers know that, so crediting "Anonymous Wife" under each title
-- was a label that added nothing: it dressed up the absence of a name as if it
-- were a name, and it invited the creator to invent a persona for each story
-- rather than let the story stand on what is in it.
--
-- `source_type` goes with it. It existed only to choose between her own alias
-- and a contributor's, so with no alias to choose it is data nothing reads.
--
-- What remains under a title is what a reader can act on: the category, when it
-- went out, and how long it takes to read. The "Anonymous story" kicker stays —
-- that is the privacy promise, not a byline.

-- ---------------------------------------------------------------------------
-- Drop what depends on the columns
-- ---------------------------------------------------------------------------

drop function if exists public.cnt_search_stories(text, integer);
drop view if exists public.cnt_story_cards;
drop function if exists public.cnt_create_story(
  text, text, public.cnt_story_type, smallint, text, text, public.cnt_source_type);

-- The full-text vector weighted the alias at C. Rebuilding it drops the GIN
-- index with the column, so both are recreated below.
alter table public.cnt_stories drop column search;

alter table public.cnt_stories
  drop column author_alias,
  drop column source_type;

drop type if exists public.cnt_source_type;

alter table public.cnt_stories
  add column search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) stored;

create index cnt_stories_search_idx on public.cnt_stories using gin (search);

-- ---------------------------------------------------------------------------
-- Rebuild without it
-- ---------------------------------------------------------------------------

create view public.cnt_story_cards
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
  -- The story's debut is when its first part went out.
  p.first_published_at as published_at,
  coalesce(p.published_part_count, 0) as part_count,
  case
    when s.story_type = 'single' then 1
    else greatest(coalesce(s.planned_part_count, 0), coalesce(p.published_part_count, 0))
  end as total_part_count,
  greatest(coalesce(p.read_minutes, 0), 1) as read_minutes
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                       as published_part_count,
    min(sp.published_at)                as first_published_at,
    coalesce(sum(sp.read_minutes), 0)::int as read_minutes
  from public.cnt_story_parts sp
  where sp.story_id = s.id
    and sp.published_at is not null
    and sp.published_at <= now()
) p on true;

create or replace function public.cnt_search_stories(p_query text, p_limit int default 30)
returns setof public.cnt_story_cards
language sql stable set search_path = ''
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

create or replace function public.cnt_create_story(
  p_title text,
  p_summary text default '',
  p_story_type public.cnt_story_type default 'single',
  p_planned_part_count smallint default null,
  p_category_slug text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_story uuid; v_cat uuid; v_base text; v_slug text; v_n integer := 1;
begin
  if not public.usr_is_editorial() then raise exception 'not permitted'; end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'A story needs a title.' using errcode = 'check_violation';
  end if;

  select id into v_cat from public.cnt_categories where slug = p_category_slug and is_active;
  if v_cat is null then
    select id into v_cat from public.cnt_categories where is_active order by sort_order limit 1;
  end if;

  v_base := public.cnt_slugify(p_title);
  v_slug := v_base;

  loop
    begin
      insert into public.cnt_stories (slug, title, summary, category_id, story_type, planned_part_count)
      values (
        v_slug, btrim(p_title), coalesce(p_summary, ''), v_cat, p_story_type,
        case when p_story_type = 'series' then greatest(coalesce(p_planned_part_count, 2), 2) end
      )
      returning id into v_story;
      exit;
    exception when unique_violation then
      v_n := v_n + 1;
      if v_n > 50 then raise; end if;
      v_slug := v_base || '-' || v_n;
    end;
  end loop;

  -- Every story starts with its first part, single or not.
  insert into public.cnt_story_parts (story_id, part_number) values (v_story, 1);
  return v_story;
end;
$$;

revoke execute on function public.cnt_create_story(text, text, public.cnt_story_type, smallint, text) from public, anon;
grant execute on function public.cnt_create_story(text, text, public.cnt_story_type, smallint, text) to authenticated;
revoke execute on function public.cnt_search_stories(text, integer) from public, anon;
grant execute on function public.cnt_search_stories(text, integer) to anon, authenticated;
