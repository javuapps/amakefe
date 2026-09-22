-- Community rows referenced auth.users directly, so PostgREST could not join
-- them to a display name and the moderation queue had no author to show.
--
-- Pointing the foreign key at usr_profiles instead makes the relationship
-- visible to the API. Nothing is lost: usr_profiles.id is itself a cascading
-- reference to auth.users, and every auth user gets a profile row from the
-- usr_on_auth_user_created trigger before they can write anything.

alter table public.com_comments
  drop constraint com_comments_user_id_fkey,
  add constraint com_comments_user_id_fkey
    foreign key (user_id) references public.usr_profiles (id) on delete cascade;

alter table public.com_answers
  drop constraint com_answers_user_id_fkey,
  add constraint com_answers_user_id_fkey
    foreign key (user_id) references public.usr_profiles (id) on delete set null;

alter table public.com_questions
  drop constraint com_questions_user_id_fkey,
  add constraint com_questions_user_id_fkey
    foreign key (user_id) references public.usr_profiles (id) on delete set null;
