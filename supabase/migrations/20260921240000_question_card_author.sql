-- Community answers are published under a name.
--
-- The card quotes the most recent answer but said nothing about who wrote it,
-- because when it was built every reader was anonymous and there was no name to
-- show. Readers now sign in with Facebook, and an answer on the Community board
-- carries its author the way it would on the Page.
--
-- The view stays `security_invoker`, so the join is filtered by the caller's own
-- access to `usr_profiles` — and that policy admits exactly the people who have
-- published something visible, which is what an answer is. A reader who has only
-- asked Amake Fe a question is still not reachable through here.

create or replace view public.com_question_cards
with (security_invoker = true)
as
select
  q.id,
  q.body,
  q.created_at,
  (select count(*) from public.com_answers a
    where a.question_id = q.id and a.status = 'visible')::int as answer_count,
  latest.body        as latest_answer,
  latest.author_name as latest_answer_author
from public.com_questions q
left join lateral (
  select a.body, p.display_name as author_name
  from public.com_answers a
  left join public.usr_profiles p on p.id = a.user_id
  where a.question_id = q.id and a.status = 'visible'
  order by a.created_at desc
  limit 1
) latest on true
where q.status = 'visible';
