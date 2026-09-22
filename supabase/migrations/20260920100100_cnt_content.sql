-- Content module.
--
-- One story table carries both anonymous contributor stories and the creator's own
-- posts, separated by source_type — the spec's separate `creator_posts` table would
-- have duplicated every column, index and policy for no behavioural difference.
--
-- Categories are the single taxonomy: one per story, they drive the filter chips and
-- the follow list. Tags/topics are deliberately absent until something needs them.
--
-- Nothing here touches contributor identity. Real names, phone numbers, consent
-- records and source audio live in the editorial module, which the reader app's
-- roles cannot reach at all.

create type public.cnt_story_status as enum (
  'draft',
  'in_review',
  'consent_pending',
  'approved',
  'scheduled',
  'published',
  'archived',
  'rejected'
);

create type public.cnt_source_type as enum (
  'contributor',  -- told to the creator by phone or voice note, published anonymously
  'creator'       -- the creator's own story, advice or reflection
);

create table public.cnt_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true
);

create table public.cnt_stories (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title              text not null,
  summary            text not null,
  category_id        uuid not null references public.cnt_categories (id) on delete restrict,
  source_type        public.cnt_source_type not null default 'contributor',
  -- Public identity only: "Anonymous Wife", "Anonymous Husband", a chosen pseudonym.
  author_alias       text not null,
  status             public.cnt_story_status not null default 'draft',
  cover_image_path   text,
  -- The creator's reflection shown after the final part.
  creator_note       text,
  -- What the editor intends to publish in total; lets the reader show "Part 2 of 5"
  -- while the series is still running.
  planned_part_count smallint,
  published_at       timestamptz,
  like_count         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  search             tsvector generated always as (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                       setweight(to_tsvector('english', coalesce(author_alias, '')), 'C')
                     ) stored,
  constraint cnt_stories_published_has_date check (
    status <> 'published' or published_at is not null
  )
);

create index cnt_stories_feed_idx
  on public.cnt_stories (published_at desc)
  where status = 'published';
create index cnt_stories_category_idx on public.cnt_stories (category_id);
create index cnt_stories_search_idx    on public.cnt_stories using gin (search);

create trigger cnt_stories_set_updated_at
  before update on public.cnt_stories
  for each row execute function public.set_updated_at();

create table public.cnt_story_parts (
  id           uuid primary key default gen_random_uuid(),
  story_id     uuid not null references public.cnt_stories (id) on delete cascade,
  part_number  smallint not null check (part_number > 0),
  title        text,
  -- Markdown. Paragraphs are separated by blank lines and rendered by the client.
  body         text not null,
  read_minutes smallint,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search       tsvector generated always as (
                 to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
               ) stored,
  unique (story_id, part_number)
);

create index cnt_story_parts_search_idx on public.cnt_story_parts using gin (search);

create trigger cnt_story_parts_set_updated_at
  before update on public.cnt_story_parts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

-- A story is public once published and its publish time has passed; a scheduled
-- story stays invisible until then. Parts publish one at a time, so each part
-- carries its own gate.
create or replace function public.cnt_story_is_public(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cnt_stories s
    where s.id = p_story_id
      and s.status = 'published'
      and s.published_at <= now()
  );
$$;

-- Feed/card shape. security_invoker keeps the caller's RLS in force, so the view
-- cannot leak anything the caller could not select directly.
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

-- Search across titles, summaries and the story text itself.
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

-- ---------------------------------------------------------------------------
-- RLS — reading is open to everyone, including signed-out readers
-- ---------------------------------------------------------------------------

alter table public.cnt_categories  enable row level security;
alter table public.cnt_stories     enable row level security;
alter table public.cnt_story_parts enable row level security;

create policy cnt_categories_read_all
  on public.cnt_categories for select
  to anon, authenticated
  using (is_active);

create policy cnt_stories_read_published
  on public.cnt_stories for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy cnt_story_parts_read_published
  on public.cnt_story_parts for select
  to anon, authenticated
  using (
    published_at is not null
    and published_at <= now()
    and public.cnt_story_is_public(story_id)
  );

-- Editorial access. The publisher app writes through these; the reader app never does.
create policy cnt_categories_staff_all
  on public.cnt_categories for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy cnt_stories_staff_all
  on public.cnt_stories for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy cnt_story_parts_staff_all
  on public.cnt_story_parts for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());
