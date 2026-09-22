-- Community becomes one timeline.
--
-- There were four places a reader could meet the community and no way to see
-- them together: her notices in `cnt_creator_posts`, a poll in `com_polls`,
-- questions to her in `com_ask_questions`, and a separate peer Q&A in
-- `com_questions` / `com_answers`. Two of those were answered by her and two by
-- other readers, on two different screens, under two different names.
--
-- Now: **questions, polls and notices are one stream**, and readers react and
-- comment on any of them.
--
-- One table with a `kind` rather than three tables under a union view. The
-- kinds share nearly everything that matters — a body, a publication time, a
-- like count — a timeline over one table needs no union and no second ordering,
-- and reactions and comments get real foreign keys instead of a
-- `(kind, id)` pair that no constraint can defend. What differs per kind is
-- held by check constraints below, so an impossible row cannot be written.
--
-- **The peer Q&A goes.** Commenting on a post is the same act done better, and
-- keeping both would leave a second answering mechanism nobody navigates to.

create type public.com_post_kind as enum ('question', 'poll', 'notice');

create table public.com_posts (
  id           uuid primary key default gen_random_uuid(),
  kind         public.com_post_kind not null,

  -- The question asked, the poll's question, or the notice itself.
  body         text not null check (char_length(btrim(body)) between 1 and 4000),

  -- Questions only: who asked, and her reply. The asker is never shown — see
  -- the policy on usr_profiles — and a question reaches the timeline only once
  -- it has an answer.
  asked_by     uuid references public.usr_profiles (id) on delete set null,
  answer       text,
  answered_at  timestamptz,

  -- Polls only.
  closes_at    timestamptz,

  -- The one gate for every kind: on the timeline exactly while this is set and
  -- has passed. The same rule as a story part, for the same reason — a second
  -- status column can disagree with it, and did, in the story tables.
  published_at timestamptz,

  like_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Only a question has an asker or an answer; only a poll closes.
  constraint com_posts_question_shape check (
    kind = 'question'
    or (asked_by is null and answer is null and answered_at is null)
  ),
  constraint com_posts_poll_shape check (kind = 'poll' or closes_at is null),
  -- An unanswered question is not something to publish.
  constraint com_posts_answered_before_published check (
    kind <> 'question' or published_at is null or answer is not null
  ),
  constraint com_posts_answer_has_time check (
    (answer is null) = (answered_at is null)
  )
);

create index com_posts_timeline_idx on public.com_posts (published_at desc)
  where published_at is not null;
create index com_posts_asker_idx on public.com_posts (asked_by);

create trigger com_posts_set_updated_at
  before update on public.com_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Engagement, now with somewhere to hang
-- ---------------------------------------------------------------------------

create table public.com_post_reactions (
  post_id    uuid not null references public.com_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.com_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.com_posts (id) on delete cascade,
  user_id    uuid not null references public.usr_profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  status     public.com_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index com_post_comments_post_idx on public.com_post_comments (post_id, created_at desc);
create index com_post_comments_user_idx on public.com_post_comments (user_id);

create trigger com_post_comments_set_updated_at
  before update on public.com_post_comments
  for each row execute function public.set_updated_at();

-- like_count is kept on the row rather than counted per read, the same way
-- cnt_stories.like_count is.
create or replace function public.com_sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.com_posts p
     set like_count = (
       select count(*) from public.com_post_reactions r where r.post_id = p.id
     )
   where p.id = coalesce(new.post_id, old.post_id);
  return null;
end;
$$;

create trigger com_post_reactions_sync_like_count
  after insert or delete on public.com_post_reactions
  for each row execute function public.com_sync_post_like_count();

revoke execute on function public.com_sync_post_like_count() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Move what exists onto the timeline
-- ---------------------------------------------------------------------------

-- Notices: her posts, already published or not.
insert into public.com_posts (kind, body, published_at, created_at, updated_at)
select 'notice', body, published_at, created_at, updated_at
from public.cnt_creator_posts;

-- Questions: an answered one keeps its answer; a published one keeps its place.
insert into public.com_posts (kind, body, asked_by, answer, answered_at, published_at, created_at)
select
  'question',
  body,
  user_id,
  answer,
  answered_at,
  case when is_published then coalesce(answered_at, created_at) end,
  created_at
from public.com_ask_questions;

-- Polls, with their options and votes following them across.
insert into public.com_posts (id, kind, body, closes_at, published_at, created_at)
select id, 'poll', question, closes_at, case when is_active then created_at end, created_at
from public.com_polls;

alter table public.com_poll_options
  drop constraint com_poll_options_poll_id_fkey,
  add constraint com_poll_options_poll_id_fkey
    foreign key (poll_id) references public.com_posts (id) on delete cascade;

alter table public.com_poll_votes
  drop constraint com_poll_votes_poll_id_fkey,
  add constraint com_poll_votes_poll_id_fkey
    foreign key (poll_id) references public.com_posts (id) on delete cascade;

-- Two things stand on the tables about to go.
--
-- `com_question_cards` was the peer Q&A's feed view; it goes with them.
drop view public.com_question_cards;

-- And the profile-visibility policy named com_answers and com_questions among
-- the ways to have published something. Commenting on a post is now one of
-- those ways, and asking a question is not — a question goes out anonymously,
-- so having asked one must not make its author findable. Same rule as before,
-- pointed at where public writing actually happens now.
drop policy if exists usr_profiles_read_published on public.usr_profiles;

create policy usr_profiles_read_published
  on public.usr_profiles for select
  to anon, authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.com_comments c
      where c.user_id = public.usr_profiles.id and c.status = 'visible'
    )
    or exists (
      select 1 from public.com_post_comments pc
      where pc.user_id = public.usr_profiles.id and pc.status = 'visible'
    )
  );

-- The old homes, and the peer Q&A that comments replace.
drop table public.com_answers;
drop table public.com_questions;
drop table public.com_ask_questions;
drop table public.com_polls;
drop table public.cnt_creator_posts;

-- ---------------------------------------------------------------------------
-- Who may see and do what
-- ---------------------------------------------------------------------------

alter table public.com_posts          enable row level security;
alter table public.com_post_reactions enable row level security;
alter table public.com_post_comments  enable row level security;

-- The timeline is public. A draft, an unanswered question and a closed-away
-- poll are all simply not on it.
create policy com_posts_read_published
  on public.com_posts for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

-- A reader may see their own question before she has answered it, which is
-- what "Your questions" shows them.
create policy com_posts_read_own_question
  on public.com_posts for select
  to authenticated
  using (asked_by = (select auth.uid()));

-- Asking is the one thing a reader may write here, and only as themselves,
-- unanswered and unpublished. Everything else on this table is hers.
create policy com_posts_ask
  on public.com_posts for insert
  to authenticated
  with check (
    kind = 'question'
    and asked_by = (select auth.uid())
    and answer is null
    and published_at is null
  );

create policy com_posts_staff_all
  on public.com_posts for all
  to authenticated
  using (public.usr_is_staff())
  with check (public.usr_is_staff());

-- Reactions: counted in public, owned privately.
create policy com_post_reactions_own
  on public.com_post_reactions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy com_post_comments_read_visible
  on public.com_post_comments for select
  to anon, authenticated
  using (
    status = 'visible'
    and exists (
      select 1 from public.com_posts p
      where p.id = post_id and p.published_at is not null and p.published_at <= now()
    )
  );

create policy com_post_comments_insert_own
  on public.com_post_comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.com_posts p
      where p.id = post_id and p.published_at is not null and p.published_at <= now()
    )
  );

create policy com_post_comments_modify_own
  on public.com_post_comments for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'visible')
  with check (user_id = (select auth.uid()));

create policy com_post_comments_delete_own
  on public.com_post_comments for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy com_post_comments_staff_all
  on public.com_post_comments for all
  to authenticated
  using (public.usr_is_staff())
  with check (public.usr_is_staff());

-- ---------------------------------------------------------------------------
-- What the timeline reads
-- ---------------------------------------------------------------------------

/**
 * A post with the numbers beside it, so the feed is one query.
 *
 * `security_invoker`, so the policies above do the filtering: a reader sees the
 * published timeline plus their own unanswered questions, and staff see
 * everything. Counting comments here keeps the client from asking per row.
 */
create view public.com_post_cards
with (security_invoker = true)
as
select
  p.id,
  p.kind,
  p.body,
  p.answer,
  p.answered_at,
  p.closes_at,
  p.published_at,
  p.created_at,
  p.like_count,
  p.asked_by,
  (select count(*) from public.com_post_comments c
    where c.post_id = p.id and c.status = 'visible')::int as comment_count,
  (select count(*) from public.com_poll_votes v where v.poll_id = p.id)::int as vote_count
from public.com_posts p;

-- The results view follows the rename of its parent.
create or replace view public.com_poll_results
with (security_invoker = true)
as
select
  o.poll_id,
  o.id   as option_id,
  o.label,
  o.sort_order,
  (select count(*) from public.com_poll_votes v where v.option_id = o.id)::int as vote_count
from public.com_poll_options o;
