-- Scheduling is publishing, later.
--
-- `cnt_publish_part` refuses an empty part, because a blank page in front of
-- 200k readers is the worst thing this software can do. Scheduling wrote
-- `published_at` straight to the row and checked nothing, so the same mistake
-- was still available — it just took until Tuesday to happen.
--
-- Same guard, then, plus one scheduling does not share: the time has to be in
-- the future. A past time is not a schedule, it is publishing now, and that is
-- `cnt_publish_part` — an RPC that quietly did both would make "scheduled" and
-- "live" depend on how long the request took.

create or replace function public.cnt_schedule_part(p_part_id uuid, p_at timestamptz)
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
    raise exception 'This part is empty. Write it before scheduling it.'
      using errcode = 'check_violation';
  end if;
  if p_at <= now() then
    raise exception 'That time has passed. Pick a later one, or publish it now.'
      using errcode = 'check_violation';
  end if;

  update public.cnt_story_parts set published_at = p_at where id = p_part_id;
end;
$$;

revoke execute on function public.cnt_schedule_part(uuid, timestamptz) from public, anon;
grant execute on function public.cnt_schedule_part(uuid, timestamptz) to authenticated;
