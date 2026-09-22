-- Names the story is told with, and the names readers get.
--
-- A contributor tells her story using real names — her husband's, her sister's,
-- the compound she lives in. Asking the creator to invent substitutes while she
-- writes is how detail gets lost and how a slip gets published. So she writes
-- what she was told, lists the words that must not leave the building, and the
-- database replaces each one with `**********` on its way out.
--
-- The redaction is **not** cosmetic and it does not happen in the browser. If it
-- did, the real names would still sit in `cnt_story_parts.body`, one request
-- away for anyone holding the publishable key — which is the whole failure this
-- product exists to avoid. So:
--
--   * `cnt_story_parts` becomes staff-only. Readers cannot select it at all.
--   * `cnt_public_parts` is the public API: published parts, redacted. It runs
--     as its owner precisely because it must reach rows the caller may not,
--     and it exposes no column that could carry an unredacted name.
--
-- A fixed ten asterisks, not one per letter: a mask that tracks length tells you
-- the name has six letters, which is a clue you did not mean to give.
--
-- `cnt_public_parts` trips Supabase's `security_definer_view` advisor, at ERROR
-- level, and that is intentional and must stay. The lint exists because such a
-- view can hand a caller rows their own RLS would refuse — which is exactly the
-- job here. Do NOT "fix" it by adding `security_invoker = true`: the reader
-- would then get nothing, and the obvious next move — restoring an anon SELECT
-- policy on cnt_story_parts — publishes every real name in the table. The view
-- is safe because of what it selects, not who runs it: every text column is
-- wrapped in a redaction call, `body` is never exposed raw, `facebook_teaser`
-- and `body_text` are not exposed at all, and the WHERE clause admits only
-- published parts.

alter table public.cnt_story_parts
  add column anonymise_terms text[] not null default '{}';

comment on column public.cnt_story_parts.anonymise_terms is
  'Words replaced with ********** everywhere this part is published. Never leaves the studio.';

-- ---------------------------------------------------------------------------
-- Redaction
-- ---------------------------------------------------------------------------

create or replace function public.cnt_redact_text(p_text text, p_terms text[])
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_out  text := p_text;
  v_term text;
begin
  if p_text is null or p_terms is null then
    return p_text;
  end if;

  foreach v_term in array p_terms loop
    v_term := btrim(v_term);
    continue when v_term = '';
    -- \m and \M are word boundaries, so "Mando" does not redact "Mandolin" —
    -- but "Mando's" still goes, because an apostrophe ends a word.
    v_out := regexp_replace(
      v_out,
      '\m' || regexp_replace(v_term, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M',
      '**********',
      'gi');
  end loop;

  return v_out;
end;
$$;

-- plpgsql rather than SQL because it recurses, and a SQL body cannot refer to
-- the function being created.
create or replace function public.cnt_redact_doc(doc jsonb, p_terms text[])
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_out jsonb;
  v_key text;
  v_val jsonb;
begin
  if doc is null or p_terms is null or array_length(p_terms, 1) is null then
    return doc;
  end if;

  case jsonb_typeof(doc)
    when 'array' then
      select coalesce(jsonb_agg(public.cnt_redact_doc(element, p_terms)), '[]'::jsonb)
        into v_out
        from jsonb_array_elements(doc) as element;
      return v_out;

    when 'object' then
      v_out := '{}'::jsonb;
      for v_key, v_val in select * from jsonb_each(doc) loop
        -- The three places a document holds prose a reader sees.
        if v_key in ('text', 'alt', 'caption') and jsonb_typeof(v_val) = 'string' then
          v_out := v_out || jsonb_build_object(
            v_key, to_jsonb(public.cnt_redact_text(v_val #>> '{}', p_terms)));
        else
          v_out := v_out || jsonb_build_object(v_key, public.cnt_redact_doc(v_val, p_terms));
        end if;
      end loop;
      return v_out;

    else
      return doc;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search must not match a redacted name
-- ---------------------------------------------------------------------------

-- Otherwise searching a contributor's husband by name finds her story, which is
-- the leak with the plainest route to it.
drop function if exists public.cnt_search_stories(text, integer);
alter table public.cnt_story_parts drop column search;
alter table public.cnt_story_parts
  add column search tsvector generated always as (
    to_tsvector(
      'english',
      public.cnt_redact_text(coalesce(title, ''), anonymise_terms) || ' ' ||
      public.cnt_doc_plain_text(public.cnt_redact_doc(body, anonymise_terms)))
  ) stored;

create index cnt_story_parts_search_idx on public.cnt_story_parts using gin (search);

-- ---------------------------------------------------------------------------
-- The public projection
-- ---------------------------------------------------------------------------

-- The table is now editorial-only: `body` holds what she was actually told.
drop policy if exists cnt_story_parts_read_published on public.cnt_story_parts;

create view public.cnt_public_parts as
select
  p.id,
  p.story_id,
  p.part_number,
  public.cnt_redact_text(p.title, p.anonymise_terms)        as title,
  public.cnt_redact_doc(p.body, p.anonymise_terms)          as body,
  public.cnt_redact_text(p.creator_note, p.anonymise_terms) as creator_note,
  p.thumbnail_path,
  p.read_minutes,
  p.published_at,
  p.search
from public.cnt_story_parts p
where p.published_at is not null
  and p.published_at <= now();

grant select on public.cnt_public_parts to anon, authenticated;

create or replace function public.cnt_search_stories(p_query text, p_limit int default 30)
returns setof public.cnt_story_cards
language sql stable set search_path = ''
as $$
  with q as (select websearch_to_tsquery('english', p_query) as ts)
  select card.*
  from public.cnt_story_cards card
  where exists (
    select 1 from public.cnt_stories s, q
    where s.id = card.id and s.search @@ q.ts
  )
  or exists (
    select 1 from public.cnt_public_parts sp, q
    where sp.story_id = card.id and sp.search @@ q.ts
  )
  order by card.published_at desc
  limit least(p_limit, 100);
$$;

revoke execute on function public.cnt_search_stories(text, integer) from public, anon;
grant execute on function public.cnt_search_stories(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The feed reads the projection too
-- ---------------------------------------------------------------------------

-- `cnt_story_cards` is security_invoker, so its lateral over `cnt_story_parts`
-- ran as the reader — and that table is now editorial-only. Left alone, every
-- card came back with part_count 0 and a null published_at, which is the whole
-- feed. It reads the public projection instead: the same rows it is entitled
-- to, already filtered to published and already redacted.
create or replace view public.cnt_story_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.summary,
  s.story_type,
  s.cover_image_path,
  s.like_count,
  c.slug as category_slug,
  c.name as category_name,
  p.first_published_at as published_at,
  coalesce(p.published_part_count, 0) as part_count,
  case
    when s.story_type = 'single' then 1
    else greatest(coalesce(s.planned_part_count, 0), coalesce(p.published_part_count, 0))
  end as total_part_count,
  greatest(coalesce(p.read_minutes, 0), 1) as read_minutes
from public.cnt_stories s
join public.cnt_categories c on c.id = s.category_id
left join lateral (
  select
    count(*)::int                          as published_part_count,
    min(sp.published_at)                   as first_published_at,
    coalesce(sum(sp.read_minutes), 0)::int as read_minutes
  from public.cnt_public_parts sp
  where sp.story_id = s.id
) p on true;

-- The `search` generated column is computed as the writing role, and the view's
-- expressions as the reading role, so both need EXECUTE. This gives nothing
-- away: these are pure text functions over arguments the caller already holds.
grant execute on function public.cnt_redact_text(text, text[]) to anon, authenticated;
grant execute on function public.cnt_redact_doc(jsonb, text[]) to anon, authenticated;
