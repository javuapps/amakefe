-- Moderation over everything readers actually write.
--
-- Two holes, both opened by the Community merge and both invisible until
-- somebody looks:
--
--   * `mod_target_kind` still named `question` and `answer`, which were tables
--     dropped in `20260922150000`. Nothing could produce either value.
--   * `com_post_comments` — the comments under a poll, a notice or a question,
--     which is the only place most readers ever write — had no kind at all, so
--     it could not be reported and the studio's queue could not see it.
--
-- `mod_reports` is empty, so the enum is recut rather than extended: leaving
-- two values nothing can produce beside two that matter is how the next person
-- writes a switch over four cases.
create type public.mod_target_kind_next as enum ('story_comment', 'post_comment', 'story');

alter table public.mod_reports
  alter column target_kind type public.mod_target_kind_next
  using (case target_kind::text
           when 'comment' then 'story_comment'
           else target_kind::text
         end)::public.mod_target_kind_next;

drop type public.mod_target_kind;
alter type public.mod_target_kind_next rename to mod_target_kind;

-- `comment` became `story_comment`: with two kinds of comment in the product,
-- the unqualified one is a coin toss for whoever reads it next.
comment on column public.mod_reports.target_kind is
  'Which table target_id points at. There is no foreign key because it points '
  'at three, so a report outlives the thing it was about — deliberately: the '
  'moderation record is the point.';

/**
 * Hides a comment, whichever kind it is, and closes its reports.
 *
 * One function rather than one per table, because "hide this and mark the
 * reports dealt with" is one act — the studio had it for story comments as two
 * statements in the query layer, which is two chances to do half of it.
 */
create or replace function public.mod_hide_comment(
  p_kind public.mod_target_kind,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_staff() then
    raise exception 'not permitted';
  end if;

  if p_kind = 'story_comment' then
    update public.com_comments set status = 'hidden' where id = p_id;
  elsif p_kind = 'post_comment' then
    update public.com_post_comments set status = 'hidden' where id = p_id;
  else
    raise exception '% is not a comment', p_kind;
  end if;

  update public.mod_reports
     set status = 'actioned'
   where target_kind = p_kind and target_id = p_id and status = 'open';
end;
$$;

revoke execute on function public.mod_hide_comment(public.mod_target_kind, uuid) from public, anon;
grant execute on function public.mod_hide_comment(public.mod_target_kind, uuid) to authenticated;

/** Leaves the comment alone and marks its reports looked at. */
create or replace function public.mod_keep_comment(
  p_kind public.mod_target_kind,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_staff() then
    raise exception 'not permitted';
  end if;

  update public.mod_reports
     set status = 'dismissed'
   where target_kind = p_kind and target_id = p_id and status = 'open';
end;
$$;

revoke execute on function public.mod_keep_comment(public.mod_target_kind, uuid) from public, anon;
grant execute on function public.mod_keep_comment(public.mod_target_kind, uuid) to authenticated;

/**
 * Everything waiting on a moderator, from both comment tables at once.
 *
 * A view rather than two queries the app stitches together: "most reported
 * first, then newest" cannot be ordered correctly across two lists that were
 * sorted apart, and the studio was reading only one of them anyway.
 *
 * `security_invoker` so the caller's own policies decide — staff read every
 * comment through `com_comments_staff_all`, and a reader reaching this view
 * sees only what they could already see.
 */
create or replace view public.mod_comment_queue
with (security_invoker = true)
as
select
  'story_comment'::public.mod_target_kind as target_kind,
  c.id,
  c.body,
  c.created_at,
  c.status,
  p.display_name as author_name,
  s.title        as context,
  (select count(*) from public.mod_reports r
    where r.target_kind = 'story_comment' and r.target_id = c.id and r.status = 'open')::int
    as report_count
from public.com_comments c
left join public.usr_profiles p on p.id = c.user_id
left join public.cnt_stories s on s.id = c.story_id
union all
select
  'post_comment'::public.mod_target_kind,
  pc.id,
  pc.body,
  pc.created_at,
  pc.status,
  pp.display_name,
  -- A post has no title, so the post's own words stand in for one.
  left(po.body, 80),
  (select count(*) from public.mod_reports r
    where r.target_kind = 'post_comment' and r.target_id = pc.id and r.status = 'open')::int
from public.com_post_comments pc
left join public.usr_profiles pp on pp.id = pc.user_id
left join public.com_posts po on po.id = pc.post_id;
