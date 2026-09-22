-- Comments on a story, and reactions to them.
--
-- `com_comments` has existed since the first schema and nothing has ever read
-- or written it: the MVP listed comments, no prototype drew the thread, and
-- inventing that UI would have been guessing. The community timeline has since
-- settled what a thread looks like here, so this follows it rather than
-- inventing a second one.
--
-- Three things were missing.

-- ---------------------------------------------------------------------------
-- 1. The commenter has to be nameable
-- ---------------------------------------------------------------------------
--
-- `user_id` pointed at `auth.users`, through which PostgREST has no
-- relationship to embed a profile — the same wall `com_ask_questions` hit and
-- `com_post_comments` was built to avoid. Re-pointed at `usr_profiles`, which
-- is also what makes the reader's chosen name reachable in one query.
--
-- Safe to do in place: the table is empty, and `usr_profiles` holds a row for
-- every reader account. An editorial or operator account has no profile and so
-- cannot comment, which is correct — the studio is not where she talks to
-- readers, and Community is.
alter table public.com_comments
  drop constraint com_comments_user_id_fkey,
  add constraint com_comments_user_id_fkey
    foreign key (user_id) references public.usr_profiles (id) on delete cascade;

-- The `usr_profiles` visibility policy already admits anyone with a visible
-- comment here, so a commenter becomes nameable exactly when their comment is
-- readable, and someone who has only ever asked a question stays unnameable.
-- Nothing to change; stated because it is easy to assume otherwise.

-- ---------------------------------------------------------------------------
-- 2. Readers can react to a comment
-- ---------------------------------------------------------------------------

create table public.com_comment_reactions (
  comment_id uuid not null references public.com_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- One row per person per comment, so a reaction cannot be pressed twice, and
-- the count below is a fact rather than a tally somebody increments.
alter table public.com_comments add column like_count integer not null default 0;

alter table public.com_comment_reactions enable row level security;

-- A reader reads and writes their own reactions and nobody else's. The public
-- number lives on the comment, so nothing here needs to be readable to show
-- it — and who reacted to which comment about whose marriage is not a list
-- this product keeps readable.
create policy com_comment_reactions_own
  on public.com_comment_reactions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- security definer for the same reason `com_sync_like_count` is: a reader may
-- insert a reaction and must not be able to update a comment.
create or replace function public.com_sync_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.com_comments
       set like_count = like_count + 1
     where id = new.comment_id;
  else
    update public.com_comments
       set like_count = greatest(like_count - 1, 0)
     where id = old.comment_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.com_sync_comment_like_count() from public, anon, authenticated;

create trigger com_comment_reactions_sync_like_count
  after insert or delete on public.com_comment_reactions
  for each row execute function public.com_sync_comment_like_count();

-- ---------------------------------------------------------------------------
-- 3. The story has to know how many it has
-- ---------------------------------------------------------------------------
--
-- On the card rather than on `cnt_stories`, because unlike `like_count` this
-- number depends on moderation: hiding a comment must take it out of the count,
-- and a stored counter would need every status change to remember to say so.
-- The index is what keeps it cheap on a list of twelve stories.
create index com_comments_visible_by_story
  on public.com_comments (story_id)
  where status = 'visible';

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
  -- Appended rather than slotted in beside `like_count`, where it belongs by
  -- meaning: `create or replace view` may only add columns at the end, and
  -- dropping the view to reorder would take its dependents with it. Column
  -- order in a view is nobody's business but the mapper's, and the mapper
  -- reads by name.
  (select count(*)
     from public.com_comments cc
    where cc.story_id = s.id and cc.status = 'visible')::int as comment_count
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                          as published_part_count,
    min(sp.published_at)                   as first_published_at,
    coalesce(sum(sp.read_minutes), 0)::int as read_minutes
  from public.cnt_public_parts sp
  where sp.story_id = s.id
) p on true;
