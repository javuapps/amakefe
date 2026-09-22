-- Removes the editorial capture machinery.
--
-- Stories are collected away from this platform — a phone call, a series of
-- WhatsApp voice notes, a conversation that happens over weeks. The consent
-- conversation happens there too. Asking the creator to re-enter a contributor's
-- name, number, consent boxes and a log of calls while she is writing was
-- duplicate data entry for something the software never witnessed.
--
-- So the whole private domain goes: the `editorial` schema, the consent gate on
-- publishing, and the RPCs that were its only window. What remains is the public
-- story and its alias, which is all the platform actually publishes.
--
-- One consequence worth stating plainly: the database no longer refuses to
-- publish a story without confirmed consent. That gate is now entirely the
-- creator's own process, outside this system.
--
-- The `edt_` prefix goes with it. Creating and publishing a story are content
-- operations, so they take the `cnt_` prefix like the rest of the module.

-- ---------------------------------------------------------------------------
-- The publish gate and its dependencies
-- ---------------------------------------------------------------------------

drop trigger if exists cnt_stories_guard_publish on public.cnt_stories;
drop function if exists public.cnt_guard_publish();
drop function if exists public.edt_consent_complete(uuid);
drop function if exists public.edt_story_record(uuid);
drop function if exists public.edt_set_consent(uuid, text, boolean);
drop function if exists public.edt_set_interview_complete(uuid, boolean);
drop function if exists public.edt_add_source(uuid, public.edt_source_kind, timestamptz, integer, text);
drop function if exists public.edt_create_story(
  text, text, text, text, public.cnt_source_type, smallint, uuid, text, text,
  public.edt_source_kind, timestamptz);
drop function if exists public.edt_publish_story(uuid);

-- ---------------------------------------------------------------------------
-- The private domain
-- ---------------------------------------------------------------------------

drop schema if exists editorial cascade;
drop type if exists public.edt_source_kind;

-- Voice notes and call recordings were the only thing this bucket held, and
-- nothing uploads to it now. Supabase blocks direct deletes from storage tables,
-- so the bucket itself goes through the Storage API; dropping the policy leaves
-- it unwritable in the meantime.
drop policy if exists source_media_editorial on storage.objects;

-- ---------------------------------------------------------------------------
-- Creating and publishing, without the contributor record
-- ---------------------------------------------------------------------------

create or replace function public.cnt_create_story(
  p_title text,
  p_summary text default '',
  p_category_slug text default null,
  p_author_alias text default 'Anonymous',
  p_source_type public.cnt_source_type default 'contributor',
  p_planned_part_count smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story uuid;
  v_cat   uuid;
  v_base  text;
  v_slug  text;
  v_n     integer := 1;
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'A story needs a title.' using errcode = 'check_violation';
  end if;

  select id into v_cat from public.cnt_categories where slug = p_category_slug and is_active;
  if v_cat is null then
    select id into v_cat from public.cnt_categories where is_active order by sort_order limit 1;
  end if;

  v_base := public.cnt_slugify(p_title);
  v_slug := v_base;

  -- Retry inside the transaction that holds the unique index, so two editors
  -- creating "The Letter" at the same moment cannot collide.
  loop
    begin
      insert into public.cnt_stories (
        slug, title, summary, category_id, author_alias, source_type, status, planned_part_count
      ) values (
        v_slug, btrim(p_title), coalesce(p_summary, ''), v_cat,
        coalesce(nullif(btrim(p_author_alias), ''), 'Anonymous'),
        p_source_type, 'draft', p_planned_part_count
      )
      returning id into v_story;
      exit;
    exception when unique_violation then
      v_n := v_n + 1;
      if v_n > 50 then raise; end if;
      v_slug := v_base || '-' || v_n;
    end;
  end loop;

  insert into public.cnt_story_parts (story_id, part_number) values (v_story, 1);
  return v_story;
end;
$$;

create or replace function public.cnt_publish_story(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part  uuid;
  v_words integer;
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;

  select id, word_count into v_part, v_words
    from public.cnt_story_parts
   where story_id = p_story_id and part_number = 1;

  if v_part is null then
    raise exception 'This story has no first part.' using errcode = 'check_violation';
  end if;
  if coalesce(v_words, 0) = 0 then
    raise exception 'Part 1 is empty. Write it before publishing.' using errcode = 'check_violation';
  end if;

  update public.cnt_stories
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_story_id;

  -- The part must be released too, or readers get a story with nothing in it:
  -- the RLS policy gates on the part's own published_at.
  update public.cnt_story_parts
     set published_at = coalesce(published_at, now())
   where id = v_part;
end;
$$;

revoke execute on function public.cnt_create_story(text, text, text, text, public.cnt_source_type, smallint) from public, anon;
revoke execute on function public.cnt_publish_story(uuid) from public, anon;
grant execute on function public.cnt_create_story(text, text, text, text, public.cnt_source_type, smallint) to authenticated;
grant execute on function public.cnt_publish_story(uuid) to authenticated;

-- usr_is_editorial() stays: it is the studio's access check, and the narrower
-- role set (creator/editor/admin/super_admin, not moderator or finance) is still
-- the right answer for who may write and publish.
