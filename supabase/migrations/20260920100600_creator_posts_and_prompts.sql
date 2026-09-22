-- Creator posts, and community questions as prompts.
--
-- Correction to the earlier decision that `creator_posts` could just be
-- `cnt_stories.source_type='creator'`. A story is titled, categorised, serialised
-- and slugged; a creator post is a paragraph and a timestamp. Folding the two
-- together would have meant a fake slug, title and category on every post.
-- source_type still earns its place — a story she writes about her own life is a
-- story — but short-form posts get their own table.
--
-- com_questions.user_id becomes nullable for the same reason com_ask_questions'
-- is: the Community screen's questions are prompts, and the creator posts them.
-- Answers likewise, so she can carry an answer over from the Facebook thread the
-- community already lives in.

create table public.cnt_creator_posts (
  id           uuid primary key default gen_random_uuid(),
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index cnt_creator_posts_feed_idx on public.cnt_creator_posts (published_at desc)
  where published_at is not null;

create trigger cnt_creator_posts_set_updated_at
  before update on public.cnt_creator_posts
  for each row execute function public.set_updated_at();

alter table public.cnt_creator_posts enable row level security;

create policy cnt_creator_posts_read_published
  on public.cnt_creator_posts for select to anon, authenticated
  using (published_at is not null and published_at <= now());

create policy cnt_creator_posts_staff_all
  on public.cnt_creator_posts for all to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

alter table public.com_questions alter column user_id drop not null;
alter table public.com_questions
  drop constraint com_questions_user_id_fkey,
  add constraint com_questions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

alter table public.com_answers alter column user_id drop not null;
alter table public.com_answers
  drop constraint com_answers_user_id_fkey,
  add constraint com_answers_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

-- A question with its answer count and the most recent answer, which is what the
-- Community list and the Home card both show.
create view public.com_question_cards
with (security_invoker = true)
as
select
  q.id,
  q.body,
  q.created_at,
  (select count(*) from public.com_answers a
    where a.question_id = q.id and a.status = 'visible')::int as answer_count,
  (select a.body from public.com_answers a
    where a.question_id = q.id and a.status = 'visible'
    order by a.created_at desc limit 1) as latest_answer
from public.com_questions q
where q.status = 'visible';

-- ---------------------------------------------------------------------------
-- Seed (development), matching the prototypes.
-- ---------------------------------------------------------------------------

insert into public.cnt_creator_posts (body, published_at)
select
  'Part 4 of "The Number I Kept Calling" comes tomorrow evening. Before you read it, I want to say something about what happens when a woman finally asks the question she has been avoiding.',
  now() - interval '2 hours'
where not exists (select 1 from public.cnt_creator_posts);

with prompt (body, answers) as (
  values
    (
      'What is one thing you wish you knew before getting married?',
      array[
        'That love and compatibility are two different projects, and only one of them is finished on the wedding day.',
        'That you will have the same argument for ten years in different clothes.'
      ]
    ),
    (
      'Can trust be rebuilt after cheating?',
      array[
        'It can, but not by the person who was hurt. They can only allow it. The rebuilding is the other one''s work, daily, for years.',
        'In my house it was rebuilt. It took three years and it is not the same trust. It is a quieter one.'
      ]
    ),
    (
      'Should a wife know her husband''s salary?',
      array[
        'We both know. What took longer was agreeing on what the money was for.'
      ]
    )
),
inserted as (
  insert into public.com_questions (user_id, body)
  select null::uuid, p.body
  from prompt p
  where not exists (select 1 from public.com_questions q where q.body = p.body)
  returning id, body
)
insert into public.com_answers (question_id, user_id, body)
select i.id, null::uuid, answer
from inserted i
join prompt p on p.body = i.body
cross join lateral unnest(p.answers) as answer;
