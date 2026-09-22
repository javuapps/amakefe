-- Publishing a scheduled part left it scheduled.
--
-- `cnt_publish_part` set `published_at = coalesce(published_at, now())`, which
-- keeps whatever is already there — and for a scheduled part that is a time in
-- the future. So "Publish it now instead" reported success and changed nothing:
-- the part stayed invisible until its original slot, and its Facebook post was
-- not due either, because the queue reads the same column.
--
-- Publishing means live now. A part that is already live keeps the date it went
-- out on, because that is a fact about the past and not ours to rewrite.
create or replace function public.cnt_publish_part(p_part_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
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
     set published_at = case
           when published_at is null or published_at > now() then now()
           else published_at
         end
   where id = p_part_id;
end;
$$;
