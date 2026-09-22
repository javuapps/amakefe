-- Ask Her, from the creator's side.
--
-- Readers could already send questions and read the answered ones. Nothing in
-- the studio ever showed them to her, so every question landed in this table and
-- stayed there. This is the half that was missing.
--
-- Two changes, both so she can see who is asking:

-- 1. Point the author at `usr_profiles`, the way com_comments and com_answers
--    already do. The old foreign key went to auth.users, which PostgREST cannot
--    embed a profile through — there is no relationship between the two tables
--    for it to follow. Deleting a reader still clears the author, because
--    usr_profiles cascades from auth.users and this then sets null.
alter table public.com_ask_questions
  drop constraint com_ask_questions_user_id_fkey,
  add constraint com_ask_questions_user_id_fkey
    foreign key (user_id) references public.usr_profiles (id) on delete set null;

-- The queue is read newest-first and filtered by state, so the ordering column
-- is worth an index once there are more than a handful.
create index if not exists com_ask_created_idx on public.com_ask_questions (created_at desc);
