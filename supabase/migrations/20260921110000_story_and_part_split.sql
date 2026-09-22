-- Story and part, properly divided.
--
-- The story carries what it *is*: type, title, summary, category, cover image.
-- The part carries what gets written and sent: its own title, thumbnail,
-- content, the creator's closing thoughts, its Facebook teaser, and whether it
-- is published. A single story is a story with exactly one part — not a special
-- case with a different shape.
--
-- Publishing therefore lives entirely on the part. The eight-value
-- `cnt_story_status` enum goes with it: published or not is `published_at`, and
-- Publish / Unpublish are the only two actions.

-- ---------------------------------------------------------------------------
-- New shape
-- ---------------------------------------------------------------------------

create type public.cnt_story_type as enum ('single', 'series');

alter table public.cnt_stories
  add column story_type public.cnt_story_type not null default 'single';

-- Anything that was already running in parts, or planned to, is a series.
update public.cnt_stories s
   set story_type = 'series'
 where coalesce(s.planned_part_count, 1) > 1
    or (select count(*) from public.cnt_story_parts p where p.story_id = s.id) > 1;

-- A planned count is a series' estimate of how many parts are coming. It is
-- meaningless for a single story, so it is not merely ignored there — it cannot
-- be set.
update public.cnt_stories set planned_part_count = null where story_type = 'single';
update public.cnt_stories set planned_part_count = 2
 where story_type = 'series' and coalesce(planned_part_count, 0) < 2;

alter table public.cnt_stories
  add constraint cnt_stories_planned_parts_match_type check (
    case story_type
      when 'single' then planned_part_count is null
      when 'series' then planned_part_count >= 2
    end
  );

alter table public.cnt_story_parts
  add column creator_note  text,
  -- Its own image, distinct from the story's cover: the picture for this
  -- instalment, and what its Facebook post shows.
  add column thumbnail_path text;

-- The note was shown after a story's final part, so that is where it belongs.
update public.cnt_story_parts p
   set creator_note = s.creator_note
  from public.cnt_stories s
 where s.id = p.story_id
   and s.creator_note is not null
   and p.part_number = (select max(x.part_number) from public.cnt_story_parts x where x.story_id = s.id);

-- ---------------------------------------------------------------------------
-- Drop everything that depended on story-level publishing
-- ---------------------------------------------------------------------------

drop function if exists public.cnt_search_stories(text, integer);
drop view if exists public.cnt_story_cards;
drop trigger if exists cnt_stories_lock_slug on public.cnt_stories;
drop function if exists public.cnt_lock_published_slug();
drop function if exists public.cnt_publish_story(uuid);
-- Its replacement below takes a different signature, which would otherwise
-- overload rather than replace it — and an overload is ambiguous over PostgREST.
drop function if exists public.cnt_create_story(
  text, text, text, text, public.cnt_source_type, smallint);
drop policy if exists cnt_stories_read_published on public.cnt_stories;
drop index if exists public.cnt_stories_feed_idx;

alter table public.cnt_stories
  drop column creator_note,
  drop column status,
  drop column published_at;

drop type if exists public.cnt_story_status;

create index cnt_story_parts_live_idx
  on public.cnt_story_parts (story_id, published_at desc)
  where published_at is not null;

-- ---------------------------------------------------------------------------
-- Visibility now derives from the parts
-- ---------------------------------------------------------------------------

-- A part is public on its own terms; nothing else to consult.
drop policy if exists cnt_story_parts_read_published on public.cnt_story_parts;
create policy cnt_story_parts_read_published
  on public.cnt_story_parts for select to anon, authenticated
  using (published_at is not null and published_at <= now());

-- SECURITY DEFINER so the story policy below can look at parts without RLS
-- recursing back into the story.
create or replace function public.cnt_story_is_public(p_story_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cnt_story_parts p
    where p.story_id = p_story_id
      and p.published_at is not null
      and p.published_at <= now()
  );
$$;

create policy cnt_stories_read_published
  on public.cnt_stories for select to anon, authenticated
  using (public.cnt_story_is_public(id));

create or replace function public.cnt_is_series(p_story_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.story_type = 'series' from public.cnt_stories s where s.id = p_story_id),
    false);
$$;

-- ---------------------------------------------------------------------------
-- A single story has exactly one part
-- ---------------------------------------------------------------------------

create or replace function public.cnt_guard_single_part()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select s.story_type from public.cnt_stories s where s.id = new.story_id) = 'single'
     and (select count(*) from public.cnt_story_parts p where p.story_id = new.story_id) > 0
  then
    raise exception 'A single story has one part. Change it to a series to add more.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cnt_story_parts_guard_single
  before insert on public.cnt_story_parts
  for each row execute function public.cnt_guard_single_part();

-- ---------------------------------------------------------------------------
-- The reader's view
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Creating, publishing, unpublishing
-- ---------------------------------------------------------------------------

create or replace function public.cnt_create_story(
  p_title text,
  p_summary text default '',
  p_story_type public.cnt_story_type default 'single',
  p_planned_part_count smallint default null,
  p_category_slug text default null,
  p_author_alias text default 'Anonymous',
  p_source_type public.cnt_source_type default 'contributor'
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
      insert into public.cnt_stories (
        slug, title, summary, category_id, author_alias, source_type,
        story_type, planned_part_count
      ) values (
        v_slug, btrim(p_title), coalesce(p_summary, ''), v_cat,
        coalesce(nullif(btrim(p_author_alias), ''), 'Anonymous'), p_source_type,
        p_story_type,
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

create or replace function public.cnt_publish_part(p_part_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_words integer;
begin
  if not public.usr_is_editorial() then raise exception 'not permitted'; end if;

  select word_count into v_words from public.cnt_story_parts where id = p_part_id;
  if v_words is null then
    raise exception 'No such part.' using errcode = 'check_violation';
  end if;
  if v_words = 0 then
    raise exception 'This part is empty. Write it before publishing.' using errcode = 'check_violation';
  end if;

  update public.cnt_story_parts
     set published_at = coalesce(published_at, now())
   where id = p_part_id;
end;
$$;

create or replace function public.cnt_unpublish_part(p_part_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then raise exception 'not permitted'; end if;
  update public.cnt_story_parts set published_at = null where id = p_part_id;
end;
$$;

create or replace function public.cnt_guard_story_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A published story's address is already in shared links and Facebook posts.
  if new.slug is distinct from old.slug and public.cnt_story_is_public(old.id) then
    raise exception 'The address of a published story cannot be changed — it is already in shared links.'
      using errcode = 'check_violation';
  end if;

  -- Collapsing a series back to one story would orphan the parts already written.
  if new.story_type = 'single' and old.story_type = 'series'
     and (select count(*) from public.cnt_story_parts p where p.story_id = old.id) > 1
  then
    raise exception 'This series has more than one part. Delete the later parts before making it a single story.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger cnt_stories_guard_update
  before update on public.cnt_stories
  for each row execute function public.cnt_guard_story_update();

revoke execute on function public.cnt_guard_single_part() from public, anon, authenticated;
revoke execute on function public.cnt_guard_story_update() from public, anon, authenticated;
revoke execute on function public.cnt_create_story(text, text, public.cnt_story_type, smallint, text, text, public.cnt_source_type) from public, anon;
revoke execute on function public.cnt_publish_part(uuid) from public, anon;
revoke execute on function public.cnt_unpublish_part(uuid) from public, anon;
grant execute on function public.cnt_create_story(text, text, public.cnt_story_type, smallint, text, text, public.cnt_source_type) to authenticated;
grant execute on function public.cnt_publish_part(uuid) to authenticated;
grant execute on function public.cnt_unpublish_part(uuid) to authenticated;
revoke execute on function public.cnt_search_stories(text, integer) from public, anon;
grant execute on function public.cnt_search_stories(text, integer) to anon, authenticated;
