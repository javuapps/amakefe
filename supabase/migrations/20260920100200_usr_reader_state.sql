-- Per-reader state: saves, progress and follows.
--
-- All of it hangs off an anonymous auth.uid(), so a reader gets "continue reading"
-- and saved stories without ever identifying themselves.

create table public.usr_bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  story_id   uuid not null references public.cnt_stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index usr_bookmarks_recent_idx on public.usr_bookmarks (user_id, created_at desc);

create table public.usr_read_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  story_id         uuid not null references public.cnt_stories (id) on delete cascade,
  last_part_number smallint not null check (last_part_number > 0),
  updated_at       timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index usr_read_progress_recent_idx on public.usr_read_progress (user_id, updated_at desc);

create trigger usr_read_progress_set_updated_at
  before update on public.usr_read_progress
  for each row execute function public.set_updated_at();

create table public.usr_category_follows (
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.cnt_categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);

-- ---------------------------------------------------------------------------
-- RLS — a reader sees and writes only their own rows
-- ---------------------------------------------------------------------------

alter table public.usr_bookmarks        enable row level security;
alter table public.usr_read_progress    enable row level security;
alter table public.usr_category_follows enable row level security;

create policy usr_bookmarks_own
  on public.usr_bookmarks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy usr_read_progress_own
  on public.usr_read_progress for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy usr_category_follows_own
  on public.usr_category_follows for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
