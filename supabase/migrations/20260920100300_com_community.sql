-- Community module: reactions, comments, peer questions, Ask Her, polls.
--
-- Replies are comments with a parent — the spec's separate `comment_replies` table
-- would have been the same columns twice and would have capped the shape of the
-- thread at one level for no reason.
--
-- Community questions (answered by other readers) and Ask Her (answered by the
-- creator) are genuinely different objects with different lifecycles, so they stay
-- separate tables rather than one table with a mode flag.

create type public.com_status as enum ('visible', 'hidden');

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------

create table public.com_reactions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  story_id   uuid not null references public.cnt_stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index com_reactions_story_idx on public.com_reactions (story_id);

-- Keeps cnt_stories.like_count in step. security definer because readers can insert
-- a reaction but must not be able to update a story.
create or replace function public.com_sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.cnt_stories set like_count = like_count + 1 where id = new.story_id;
  else
    update public.cnt_stories set like_count = greatest(like_count - 1, 0) where id = old.story_id;
  end if;
  return null;
end;
$$;

create trigger com_reactions_sync_like_count
  after insert or delete on public.com_reactions
  for each row execute function public.com_sync_like_count();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table public.com_comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.cnt_stories (id) on delete cascade,
  parent_id  uuid references public.com_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  status     public.com_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index com_comments_story_idx  on public.com_comments (story_id, created_at desc);
create index com_comments_parent_idx on public.com_comments (parent_id, created_at);

create trigger com_comments_set_updated_at
  before update on public.com_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Community questions — asked by readers, answered by readers
-- ---------------------------------------------------------------------------

create table public.com_questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 5 and 500),
  status     public.com_status not null default 'visible',
  created_at timestamptz not null default now()
);

create index com_questions_recent_idx on public.com_questions (created_at desc)
  where status = 'visible';

create table public.com_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.com_questions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  status      public.com_status not null default 'visible',
  created_at  timestamptz not null default now()
);

create index com_answers_question_idx on public.com_answers (question_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ask Her — asked by readers, answered by the creator
-- ---------------------------------------------------------------------------

create table public.com_ask_questions (
  id           uuid primary key default gen_random_uuid(),
  -- Nullable: most questions reach the creator by phone or WhatsApp and are entered
  -- by her, with no app account behind them. The insert policy below still forces
  -- in-app questions to carry their author.
  user_id      uuid references auth.users (id) on delete set null,
  body         text not null check (char_length(btrim(body)) between 5 and 1000),
  answer       text,
  answered_at  timestamptz,
  -- The creator chooses which answered questions the community sees.
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint com_ask_published_has_answer check (not is_published or answer is not null)
);

create index com_ask_published_idx on public.com_ask_questions (answered_at desc)
  where is_published;

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

create table public.com_polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  is_active  boolean not null default true,
  closes_at  timestamptz,
  created_at timestamptz not null default now()
);

create table public.com_poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.com_polls (id) on delete cascade,
  label      text not null,
  sort_order smallint not null default 0
);

create index com_poll_options_poll_idx on public.com_poll_options (poll_id, sort_order);

create table public.com_poll_votes (
  poll_id    uuid not null references public.com_polls (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  option_id  uuid not null references public.com_poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index com_poll_votes_option_idx on public.com_poll_votes (option_id);

-- Results are public; individual votes are not.
create view public.com_poll_results
with (security_invoker = true)
as
select
  o.poll_id,
  o.id   as option_id,
  o.label,
  o.sort_order,
  (select count(*) from public.com_poll_votes v where v.option_id = o.id)::int as vote_count
from public.com_poll_options o;

-- ---------------------------------------------------------------------------
-- mod_ — reports
-- ---------------------------------------------------------------------------

create type public.mod_target_kind as enum ('comment', 'question', 'answer', 'story');
create type public.mod_report_status as enum ('open', 'actioned', 'dismissed');

create table public.mod_reports (
  id           uuid primary key default gen_random_uuid(),
  target_kind  public.mod_target_kind not null,
  target_id    uuid not null,
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  reason       text not null check (char_length(btrim(reason)) between 3 and 1000),
  status       public.mod_report_status not null default 'open',
  created_at   timestamptz not null default now(),
  unique (target_kind, target_id, reporter_id)
);

create index mod_reports_open_idx on public.mod_reports (created_at desc)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.com_reactions      enable row level security;
alter table public.com_comments       enable row level security;
alter table public.com_questions      enable row level security;
alter table public.com_answers        enable row level security;
alter table public.com_ask_questions  enable row level security;
alter table public.com_polls          enable row level security;
alter table public.com_poll_options   enable row level security;
alter table public.com_poll_votes     enable row level security;
alter table public.mod_reports        enable row level security;

-- Reactions: counts are public via cnt_stories.like_count; rows are the reader's own.
create policy com_reactions_own
  on public.com_reactions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Comments and community Q&A: readable by everyone, written as yourself.
create policy com_comments_read_visible
  on public.com_comments for select
  to anon, authenticated
  using (status = 'visible' and public.cnt_story_is_public(story_id));

create policy com_comments_insert_own
  on public.com_comments for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.cnt_story_is_public(story_id));

create policy com_comments_modify_own
  on public.com_comments for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'visible')
  with check (user_id = (select auth.uid()));

create policy com_comments_delete_own
  on public.com_comments for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy com_questions_read_visible
  on public.com_questions for select
  to anon, authenticated
  using (status = 'visible');

create policy com_questions_insert_own
  on public.com_questions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy com_answers_read_visible
  on public.com_answers for select
  to anon, authenticated
  using (status = 'visible');

create policy com_answers_insert_own
  on public.com_answers for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Ask Her: you can read the published answers and your own pending question.
create policy com_ask_read_published
  on public.com_ask_questions for select
  to anon, authenticated
  using (is_published);

create policy com_ask_read_own
  on public.com_ask_questions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy com_ask_insert_own
  on public.com_ask_questions for insert
  to authenticated
  with check (user_id = (select auth.uid()) and answer is null and not is_published);

-- Polls: everyone reads, signed-in readers vote once.
create policy com_polls_read_active
  on public.com_polls for select
  to anon, authenticated
  using (is_active);

create policy com_poll_options_read_all
  on public.com_poll_options for select
  to anon, authenticated
  using (true);

create policy com_poll_votes_own
  on public.com_poll_votes for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Reports: file your own, staff read and resolve them.
create policy mod_reports_insert_own
  on public.mod_reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy mod_reports_staff_read
  on public.mod_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or public.usr_is_staff());

create policy mod_reports_staff_update
  on public.mod_reports for update
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

-- Staff moderation over community content.
create policy com_comments_staff_all
  on public.com_comments for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy com_questions_staff_all
  on public.com_questions for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy com_answers_staff_all
  on public.com_answers for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy com_ask_staff_all
  on public.com_ask_questions for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy com_polls_staff_all
  on public.com_polls for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

create policy com_poll_options_staff_all
  on public.com_poll_options for all
  to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());
