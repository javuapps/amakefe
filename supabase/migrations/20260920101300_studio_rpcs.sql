-- Everything the studio needs to create and publish a story, plus three fixes.
--
-- Defects being corrected:
--   1. Publishing set the story live but left part 1 unpublished, so readers saw
--      a story with nothing in it. The part RLS gates on the part's own
--      published_at, which nothing was setting.
--   2. edt_set_consent could never set confirmed_at — `case when $2 then
--      confirmed_at else null end` preserves the existing NULL when ticking.
--   3. A single-part story could not be published at all: the consent gate
--      demanded permission to publish in multiple parts.

-- ---------------------------------------------------------------------------
-- Series or single piece
-- ---------------------------------------------------------------------------

-- Not every story is a series, and the difference changes the consent gate, the
-- editor and the URL. One definition, used everywhere.
create or replace function public.cnt_is_series(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.planned_part_count > 1
                     from public.cnt_stories s where s.id = p_story_id), false)
      or (select count(*) > 1
            from public.cnt_story_parts p where p.story_id = p_story_id);
$$;

-- ---------------------------------------------------------------------------
-- Consent (fixes 2 and 3)
-- ---------------------------------------------------------------------------

create or replace function public.edt_consent_complete(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.may_tell_story
        and k.may_publish_anonymously
        and k.details_changed
        -- Only meaningful when the story actually runs in parts.
        and (k.may_publish_in_parts or not public.cnt_is_series(p_story_id))
     from editorial.consents k where k.story_id = p_story_id),
    false
  );
$$;

create or replace function public.edt_set_consent(
  p_story_id uuid,
  p_field text,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;

  if p_field not in (
    'may_tell_story', 'may_publish_anonymously', 'details_changed',
    'may_publish_in_parts', 'may_use_promotionally'
  ) then
    raise exception 'unknown consent field %', p_field;
  end if;

  execute format('update editorial.consents set %I = $2 where story_id = $1', p_field)
    using p_story_id, p_value;

  -- Stamp the confirmation when the last required box is ticked; withdraw it the
  -- moment any is unticked. This is what the §40 record shows as "Consent
  -- confirmed 12 Aug".
  if public.edt_consent_complete(p_story_id) then
    update editorial.consents
       set confirmed_at = coalesce(confirmed_at, now()),
           confirmed_by = coalesce(confirmed_by, (select auth.uid()))
     where story_id = p_story_id;
  else
    update editorial.consents
       set confirmed_at = null, confirmed_by = null
     where story_id = p_story_id;
  end if;
end;
$$;

alter table editorial.consents
  add column if not exists interview_complete boolean not null default false;

-- §64: record the retention decision from the day the source is logged. The
-- sweep that acts on it comes later; the column is the part that is painful to
-- retrofit once there is real audio.
alter table editorial.sources
  add column if not exists retain_until timestamptz;

create or replace function public.edt_set_interview_complete(p_story_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;
  update editorial.consents set interview_complete = p_value where story_id = p_story_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The §40 story record — one window, replacing edt_story_consent
-- ---------------------------------------------------------------------------

drop function if exists public.edt_story_consent(uuid);

create or replace function public.edt_story_record(p_story_id uuid)
returns table (
  contributor_reference integer,
  interview_complete boolean,
  may_tell_story boolean,
  may_publish_anonymously boolean,
  details_changed boolean,
  may_publish_in_parts boolean,
  may_use_promotionally boolean,
  confirmed_at timestamptz,
  consent_complete boolean,
  is_series boolean,
  sources jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.reference,
    k.interview_complete,
    k.may_tell_story,
    k.may_publish_anonymously,
    k.details_changed,
    k.may_publish_in_parts,
    k.may_use_promotionally,
    k.confirmed_at,
    public.edt_consent_complete(p_story_id),
    public.cnt_is_series(p_story_id),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', s.id, 'kind', s.kind, 'occurred_at', s.occurred_at,
                'duration_minutes', s.duration_minutes, 'notes', s.notes)
              order by s.occurred_at)
         from editorial.sources s where s.story_id = p_story_id),
      '[]'::jsonb)
  from editorial.consents k
  join editorial.contributors c on c.id = k.contributor_id
  where k.story_id = p_story_id
    and public.usr_is_editorial();
$$;

comment on function public.edt_story_record(uuid) is
  'The §40 editorial record for one story. Deliberately never returns the contributor''s real name or phone — the studio shows "Contributor #10291".';

create or replace function public.edt_add_source(
  p_story_id uuid,
  p_kind public.edt_source_kind,
  p_occurred_at timestamptz default now(),
  p_duration_minutes integer default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrib uuid;
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;

  select contributor_id into v_contrib from editorial.consents where story_id = p_story_id;
  if v_contrib is null then
    raise exception 'This story has no contributor record.';
  end if;

  insert into editorial.sources (contributor_id, story_id, kind, occurred_at, duration_minutes, notes)
  values (v_contrib, p_story_id, p_kind, p_occurred_at, p_duration_minutes, p_notes);
end;
$$;

-- ---------------------------------------------------------------------------
-- Creating a story
-- ---------------------------------------------------------------------------

create or replace function public.cnt_slugify(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Apostrophes vanish rather than becoming separators, so "My Husband's
  -- Secret" is my-husbands-secret, not my-husband-s-secret.
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[''’]', '', 'g'),
          '[^a-z0-9]+', '-', 'g'),
        '-'),
      ''),
    'story');
$$;

-- editorial.consents cannot be written by any client, so creating a story has to
-- be one transaction on this side of the wall: the public story, its first part,
-- the contributor record, the consent row and the first logged conversation.
-- A story without a consent row could never be published.
create or replace function public.edt_create_story(
  p_title text,
  p_summary text default '',
  p_category_slug text default null,
  p_author_alias text default 'Anonymous',
  p_source_type public.cnt_source_type default 'contributor',
  p_planned_part_count smallint default null,
  p_contributor_id uuid default null,
  p_contributor_name text default null,
  p_contributor_phone text default null,
  p_source_kind public.edt_source_kind default null,
  p_source_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story   uuid;
  v_cat     uuid;
  v_base    text;
  v_slug    text;
  v_n       integer := 1;
  v_contrib uuid := p_contributor_id;
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

  -- Her own stories have no contributor and need no consent.
  if p_source_type = 'contributor' then
    if v_contrib is null then
      insert into editorial.contributors (real_name, phone)
      values (nullif(btrim(coalesce(p_contributor_name, '')), ''),
              nullif(btrim(coalesce(p_contributor_phone, '')), ''))
      returning id into v_contrib;
    end if;

    insert into editorial.consents (story_id, contributor_id) values (v_story, v_contrib);

    if p_source_kind is not null then
      insert into editorial.sources (contributor_id, story_id, kind, occurred_at)
      values (v_contrib, v_story, p_source_kind, coalesce(p_source_occurred_at, now()));
    end if;
  end if;

  return v_story;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing (fixes defect 1)
-- ---------------------------------------------------------------------------

create or replace function public.edt_publish_story(p_story_id uuid)
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

  -- cnt_guard_publish enforces consent on this update.
  update public.cnt_stories
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_story_id;

  -- The part must be released too, or readers get a story with nothing in it.
  update public.cnt_story_parts
     set published_at = coalesce(published_at, now())
   where id = v_part;
end;
$$;

-- A published story's address appears in Facebook posts and shared links.
create or replace function public.cnt_lock_published_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new.slug is distinct from old.slug then
    raise exception 'The address of a published story cannot be changed — it is already in shared links.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cnt_stories_lock_slug
  before update on public.cnt_stories
  for each row execute function public.cnt_lock_published_slug();

-- ---------------------------------------------------------------------------
-- Part ordering
-- ---------------------------------------------------------------------------

-- Renumbering parts swaps values that collide mid-statement, so the constraint
-- has to hold at commit rather than per row.
alter table public.cnt_story_parts
  drop constraint cnt_story_parts_story_id_part_number_key,
  add constraint cnt_story_parts_story_id_part_number_key
    unique (story_id, part_number) deferrable initially deferred;

create or replace function public.cnt_reorder_parts(p_story_id uuid, p_part_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then
    raise exception 'not permitted';
  end if;

  update public.cnt_story_parts p
     set part_number = t.ord
    from (select id, row_number() over () as ord
            from unnest(p_part_ids) with ordinality as u(id, ord)) t
   where p.id = t.id and p.story_id = p_story_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and a second line of defence
-- ---------------------------------------------------------------------------

revoke execute on function public.cnt_lock_published_slug() from public;
revoke execute on function public.cnt_is_series(uuid) from public;
revoke execute on function public.cnt_slugify(text) from public;
revoke execute on function public.cnt_reorder_parts(uuid, uuid[]) from public;
revoke execute on function public.edt_story_record(uuid) from public;
revoke execute on function public.edt_add_source(uuid, public.edt_source_kind, timestamptz, integer, text) from public;
revoke execute on function public.edt_set_interview_complete(uuid, boolean) from public;
revoke execute on function public.edt_create_story(text, text, text, text, public.cnt_source_type, smallint, uuid, text, text, public.edt_source_kind, timestamptz) from public;
revoke execute on function public.edt_publish_story(uuid) from public;
revoke execute on function public.cnt_doc_text(jsonb) from public;
revoke execute on function public.cnt_text_to_doc(text) from public;

grant execute on function public.cnt_is_series(uuid) to authenticated;
grant execute on function public.cnt_reorder_parts(uuid, uuid[]) to authenticated;
grant execute on function public.edt_story_record(uuid) to authenticated;
grant execute on function public.edt_add_source(uuid, public.edt_source_kind, timestamptz, integer, text) to authenticated;
grant execute on function public.edt_set_interview_complete(uuid, boolean) to authenticated;
grant execute on function public.edt_create_story(text, text, text, text, public.cnt_source_type, smallint, uuid, text, text, public.edt_source_kind, timestamptz) to authenticated;
grant execute on function public.edt_publish_story(uuid) to authenticated;

-- The editorial tables are already unreachable: PostgREST serves only `public`
-- and `graphql_public`, and anon/authenticated have no USAGE on this schema
-- (its ACL is postgres=UC/postgres). Enabling RLS with no policies adds a second
-- lock, in case the schema is ever exposed from the dashboard. The SECURITY
-- DEFINER functions above still reach the rows because they run as the table
-- owner, and owners bypass RLS unless FORCE is set.
alter table editorial.contributors enable row level security;
alter table editorial.consents     enable row level security;
alter table editorial.sources      enable row level security;
