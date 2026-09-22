-- Story bodies become structured documents.
--
-- `cnt_story_parts.body` changes from plain text to a ProseMirror document, so
-- the creator can write with emphasis, pull quotes, section breaks and figures
-- instead of unformatted paragraphs.
--
-- Three things downstream read plain text and must keep working: the `search`
-- tsvector, the privacy scanner, and future pgvector embeddings. Rather than
-- teach each of them JSON, a generated `body_text` column derives clean text
-- once and they all read that.
--
-- Note for anyone tempted by the shortcut: `jsonb_path_query_array(doc,
-- '$.**.text')` looks like it does this in one line, and it is IMMUTABLE, but
-- `$.**` matches both a content array and its elements, so every string comes
-- back twice. Hence the explicit walk below.

-- ---------------------------------------------------------------------------
-- Text extraction
-- ---------------------------------------------------------------------------

create or replace function public.cnt_doc_text(doc jsonb)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  result text := '';
  child  jsonb;
  kind   text;
begin
  if doc is null then
    return '';
  end if;

  if jsonb_typeof(doc) = 'array' then
    for child in select * from jsonb_array_elements(doc) loop
      result := result || public.cnt_doc_text(child);
    end loop;
    return result;
  end if;

  if jsonb_typeof(doc) <> 'object' then
    return '';
  end if;

  kind := doc->>'type';

  if doc ? 'text' then
    result := result || (doc->>'text');
  end if;

  -- A figure's alt text and caption are real content: they should be searchable
  -- and, more importantly, the privacy scanner must see them.
  if doc->'attrs' ? 'alt' then
    result := result || coalesce(doc->'attrs'->>'alt', '') || ' ';
  end if;
  if doc->'attrs' ? 'caption' then
    result := result || coalesce(doc->'attrs'->>'caption', '') || ' ';
  end if;

  if doc ? 'content' then
    result := result || public.cnt_doc_text(doc->'content');
  end if;

  -- Blank line after each block, so body_text splits into the same paragraphs
  -- the document has. The privacy scanner reports "paragraph 6" off this.
  -- blockquote is omitted deliberately: the paragraphs inside it emit their own.
  if kind in ('paragraph', 'heading', 'image', 'horizontalRule') then
    result := result || E'\n\n';
  end if;

  return result;
end;
$$;

comment on function public.cnt_doc_text(jsonb) is
  'Plain text of a ProseMirror document, one blank line between blocks. Feeds search, word_count and the privacy scanner.';

-- Used once by this migration, and by anything that needs to import plain prose.
create or replace function public.cnt_text_to_doc(body text)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'doc',
    'content', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'type', 'paragraph',
                   'content', jsonb_build_array(
                     jsonb_build_object('type', 'text', 'text', btrim(p))
                   )
                 )
               )
        from regexp_split_to_table(coalesce(body, ''), '\n\s*\n') as p
        where btrim(p) <> ''
      ),
      '[]'::jsonb
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Convert the column
-- ---------------------------------------------------------------------------

-- `search` is generated from body, so it has to go before the type changes.
drop index if exists public.cnt_story_parts_search_idx;
alter table public.cnt_story_parts drop column search;

alter table public.cnt_story_parts
  alter column body drop default,
  alter column body type jsonb using public.cnt_text_to_doc(body),
  alter column body set default '{"type":"doc","content":[]}'::jsonb;

comment on column public.cnt_story_parts.body is
  'ProseMirror document. Allowed nodes: doc, paragraph, text (marks em/strong), heading(2), blockquote, horizontalRule, image{src,alt,caption}. No links, by design.';

alter table public.cnt_story_parts
  add column body_text text
    generated always as (btrim(public.cnt_doc_text(body))) stored,
  add column word_count integer
    generated always as (
      coalesce(array_length(regexp_split_to_array(btrim(public.cnt_doc_text(body)), '\s+'), 1), 0)
    ) stored,
  add column search tsvector
    generated always as (
      to_tsvector('english', coalesce(title, '') || ' ' || btrim(public.cnt_doc_text(body)))
    ) stored;

create index cnt_story_parts_search_idx on public.cnt_story_parts using gin (search);

-- word_count lets the Series and Schedule screens list parts without ever
-- fetching a body, which matters once autosave is writing every 1.5 seconds.
