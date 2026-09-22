-- Two things the creator studio needs: a hard consent gate on publishing, and
-- real numbers for the dashboard.

-- ---------------------------------------------------------------------------
-- Consent gate
-- ---------------------------------------------------------------------------

-- Spec §16: nothing goes out until the contributor has agreed to it. The Write
-- screen shows the checklist, but the rule belongs here, where it cannot be
-- skipped by any client. A story the creator wrote about her own life needs no
-- contributor consent, so the gate applies only to contributed stories.
create or replace function public.cnt_guard_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.source_type = 'contributor'
     and not public.edt_consent_complete(new.id)
  then
    raise exception
      'Consent is not complete for this story. Every box on the consent checklist must be confirmed before it can be published.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.cnt_guard_publish() from public;

create trigger cnt_stories_guard_publish
  before insert or update on public.cnt_stories
  for each row execute function public.cnt_guard_publish();

-- ---------------------------------------------------------------------------
-- Dashboard analytics
-- ---------------------------------------------------------------------------
--
-- Everything below is computed from what readers actually did — there is no
-- separate analytics pipeline, and no number here is an estimate. Early on they
-- will mostly read zero, which is the truthful answer.
--
-- usr_read_progress stores the furthest part a reader reached, so "readers of
-- part N" is simply last_part_number >= N. That single column gives the whole
-- retention funnel.

create or replace function public.cnt_dashboard_stats()
returns table (
  weekly_readers integer,
  stories_started integer,
  stories_finished integer,
  saves integer,
  comments integer,
  monthly_support_minor bigint,
  supporters integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(distinct p.user_id) from public.usr_read_progress p
      where p.updated_at > now() - interval '7 days')::int,
    (select count(*) from public.usr_read_progress)::int,
    (select count(*) from public.usr_read_progress p
      join public.cnt_story_cards c on c.id = p.story_id
      where c.part_count > 0 and p.last_part_number >= c.part_count)::int,
    (select count(*) from public.usr_bookmarks)::int,
    (select count(*) from public.com_comments where status = 'visible')::int,
    (select coalesce(sum(t.amount_minor), 0) from public.sup_transactions t
      where t.status = 'successful'
        and t.completed_at >= date_trunc('month', now()))::bigint,
    (select count(distinct coalesce(t.user_id::text, t.provider_reference))
      from public.sup_transactions t where t.status = 'successful')::int
  where public.usr_is_staff();
$$;

create or replace function public.cnt_story_performance(p_limit integer default 20)
returns table (
  story_id uuid,
  title text,
  category_name text,
  part_count integer,
  readers integer,
  completion numeric,
  comments integer,
  saves integer,
  likes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    c.category_name,
    c.part_count,
    (select count(*) from public.usr_read_progress p where p.story_id = c.id)::int,
    case
      when (select count(*) from public.usr_read_progress p where p.story_id = c.id) = 0 then 0
      else round(
        100.0 * (select count(*) from public.usr_read_progress p
                  where p.story_id = c.id and c.part_count > 0
                    and p.last_part_number >= c.part_count)
        / (select count(*) from public.usr_read_progress p where p.story_id = c.id),
        0)
    end,
    (select count(*) from public.com_comments m where m.story_id = c.id and m.status = 'visible')::int,
    (select count(*) from public.usr_bookmarks b where b.story_id = c.id)::int,
    coalesce(c.like_count, 0)
  from public.cnt_story_cards c
  where public.usr_is_staff()
  order by (select count(*) from public.usr_read_progress p where p.story_id = c.id) desc,
           c.published_at desc
  limit least(p_limit, 100);
$$;

-- The per-part drop-off for one series, which is the chart the creator uses to
-- decide how long the next series should run.
create or replace function public.cnt_series_retention(p_story_id uuid)
returns table (part_number integer, published_at timestamptz, readers integer, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with parts as (
    select sp.part_number, sp.published_at
    from public.cnt_story_parts sp
    where sp.story_id = p_story_id
  ),
  first_part as (
    select count(*)::numeric as readers
    from public.usr_read_progress p where p.story_id = p_story_id
  )
  select
    parts.part_number::int,
    parts.published_at,
    (select count(*) from public.usr_read_progress p
      where p.story_id = p_story_id and p.last_part_number >= parts.part_number)::int,
    case when first_part.readers = 0 then 0
         else round(100.0 * (select count(*) from public.usr_read_progress p
                              where p.story_id = p_story_id
                                and p.last_part_number >= parts.part_number) / first_part.readers, 0)
    end
  from parts, first_part
  where public.usr_is_staff()
  order by parts.part_number;
$$;

revoke execute on function public.cnt_dashboard_stats() from public;
revoke execute on function public.cnt_story_performance(integer) from public;
revoke execute on function public.cnt_series_retention(uuid) from public;
grant execute on function public.cnt_dashboard_stats() to authenticated;
grant execute on function public.cnt_story_performance(integer) to authenticated;
grant execute on function public.cnt_series_retention(uuid) to authenticated;
