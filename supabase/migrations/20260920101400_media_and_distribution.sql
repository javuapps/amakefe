-- Media storage and the distribution seam.
--
-- Two buckets, not one. §54 requires private source audio to be kept separate
-- from public media; separate buckets make that structural rather than a matter
-- of getting a path prefix right — the same reasoning as the `editorial` schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public_media', 'public_media', true, 5242880,
   array['image/webp', 'image/jpeg', 'image/png']),
  -- Voice notes and call recordings. Never public; reached by signed URL only.
  ('source_media', 'source_media', false, 104857600,
   array['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm'])
on conflict (id) do nothing;

create policy public_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public_media');

create policy public_media_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public_media' and public.usr_is_editorial());

create policy public_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public_media' and public.usr_is_editorial())
  with check (bucket_id = 'public_media' and public.usr_is_editorial());

create policy public_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public_media' and public.usr_is_editorial());

-- No anon clause at all, deliberately.
create policy source_media_editorial on storage.objects
  for all to authenticated
  using (bucket_id = 'source_media' and public.usr_is_editorial())
  with check (bucket_id = 'source_media' and public.usr_is_editorial());

-- ---------------------------------------------------------------------------
-- SEO / Open Graph (§75)
-- ---------------------------------------------------------------------------

alter table public.cnt_stories
  add column seo_title        text,
  add column meta_description text,
  -- Separate from cover_image_path: the aspect ratio differs, and Facebook
  -- caches OG assets hard, so this one must stay immutable per publication.
  add column og_image_path    text;

-- ---------------------------------------------------------------------------
-- The Facebook teaser lives on the part (§76)
-- ---------------------------------------------------------------------------

-- One post per release: the hook for part 4 is not the hook for part 1. For a
-- single-part story this is simply its one teaser.
alter table public.cnt_story_parts
  add column facebook_teaser text
    check (facebook_teaser is null or char_length(facebook_teaser) <= 2000);

-- ---------------------------------------------------------------------------
-- What was published where
-- ---------------------------------------------------------------------------

create type public.cnt_channel as enum ('facebook', 'push', 'email');
create type public.cnt_publication_status as enum ('planned', 'sent', 'failed', 'skipped');

-- Rows exist only for channels that need an outbound action. The app and the
-- website are where the story simply lives — RLS publishes it there the moment
-- published_at passes — so they are not channels in this sense.
create table public.cnt_publications (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references public.cnt_stories (id) on delete cascade,
  part_id       uuid references public.cnt_story_parts (id) on delete cascade,
  channel       public.cnt_channel not null,
  status        public.cnt_publication_status not null default 'planned',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  external_id   text,
  external_url  text,
  -- Frozen at planning time, so a later teaser edit cannot silently change what
  -- went out, and so a failed post can be replayed exactly.
  payload       jsonb not null default '{}'::jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (part_id, channel)
);

create index cnt_publications_due_idx
  on public.cnt_publications (channel, scheduled_for)
  where status = 'planned';

create trigger cnt_publications_set_updated_at
  before update on public.cnt_publications
  for each row execute function public.set_updated_at();

alter table public.cnt_publications enable row level security;

create policy cnt_publications_staff_all
  on public.cnt_publications for all to authenticated
  using (public.usr_is_staff()) with check (public.usr_is_staff());

comment on table public.cnt_publications is
  'Outbound distribution log. A later Edge Function polls channel/status/scheduled_for, posts, and writes back external_id — nothing in the studio changes when it lands.';
