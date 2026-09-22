-- The private contributor domain.
--
-- This holds the most sensitive data in the product: the real names and phone
-- numbers of people who shared a marriage or family crisis on the understanding
-- that they would never be identified, plus the consent record and the source
-- material behind each story.
--
-- It lives in its own schema, not in `public` behind RLS, because PostgREST only
-- serves the schemas it is configured with — `public` and `graphql_public`. A
-- table in `editorial` cannot be reached from any client, with any key, even if
-- an RLS policy elsewhere is written wrong. Spec §63 asks for the two domains to
-- be separated; this makes the separation structural rather than a matter of
-- getting every policy right.
--
-- The module prefix convention (cnt_, com_, usr_) does not apply here: the schema
-- is the module boundary, so the prefix would only repeat it.
--
-- Access is through the SECURITY DEFINER functions at the bottom of this file,
-- each of which checks usr_is_editorial() first. Moderators are deliberately
-- excluded — they moderate comments and never need a contributor's name.
--
-- Note there is no contributor_id on cnt_stories. The link lives on this side
-- only: a contributor id sitting on a publicly readable row would let anyone
-- group several anonymous stories as "the same woman", which is exactly the
-- disclosure the aliases exist to prevent.

create schema if not exists editorial;
revoke all on schema editorial from public, anon, authenticated;

create type public.edt_source_kind as enum ('phone_call', 'voice_note', 'whatsapp_chat', 'in_person', 'other');

create table editorial.contributors (
  id           uuid primary key default gen_random_uuid(),
  -- The human-readable handle the creator uses: "Contributor #10291".
  reference    integer generated always as identity (start with 10001) unique,
  real_name    text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger contributors_set_updated_at
  before update on editorial.contributors
  for each row execute function public.set_updated_at();

-- One row per story: who told it, and exactly what they agreed to.
create table editorial.consents (
  story_id              uuid primary key references public.cnt_stories (id) on delete cascade,
  contributor_id        uuid not null references editorial.contributors (id) on delete restrict,
  may_tell_story        boolean not null default false,
  may_publish_anonymously boolean not null default false,
  details_changed       boolean not null default false,
  may_publish_in_parts  boolean not null default false,
  may_use_promotionally boolean not null default false,
  confirmed_at          timestamptz,
  confirmed_by          uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index consents_contributor_idx on editorial.consents (contributor_id);

create trigger consents_set_updated_at
  before update on editorial.consents
  for each row execute function public.set_updated_at();

-- The calls and voice notes a story was built from. Media lives in a private
-- storage bucket; only its path is recorded here.
create table editorial.sources (
  id             uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references editorial.contributors (id) on delete cascade,
  story_id       uuid references public.cnt_stories (id) on delete set null,
  kind           public.edt_source_kind not null,
  occurred_at    timestamptz not null default now(),
  duration_minutes integer,
  media_path     text,
  notes          text,
  created_at     timestamptz not null default now()
);

create index sources_contributor_idx on editorial.sources (contributor_id, occurred_at desc);
create index sources_story_idx on editorial.sources (story_id);

-- ---------------------------------------------------------------------------
-- Who may look
-- ---------------------------------------------------------------------------

-- Narrower than usr_is_staff(): moderators and finance are excluded. Spec §62
-- asks for source information to reach the smallest necessary group.
create or replace function public.usr_is_editorial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usr_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('creator', 'editor', 'admin', 'super_admin')
  );
$$;

revoke execute on function public.usr_is_editorial() from public;
grant execute on function public.usr_is_editorial() to authenticated;

-- ---------------------------------------------------------------------------
-- The only way in
-- ---------------------------------------------------------------------------

-- What the Write screen needs: the consent checklist for one story, plus the
-- contributor's reference number. Never the name or the phone number — the
-- editing screen has no use for them, so they are not returned.
create or replace function public.edt_story_consent(p_story_id uuid)
returns table (
  contributor_reference integer,
  may_tell_story boolean,
  may_publish_anonymously boolean,
  details_changed boolean,
  may_publish_in_parts boolean,
  may_use_promotionally boolean,
  confirmed_at timestamptz,
  source_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.reference,
    k.may_tell_story,
    k.may_publish_anonymously,
    k.details_changed,
    k.may_publish_in_parts,
    k.may_use_promotionally,
    k.confirmed_at,
    (select count(*) from editorial.sources s where s.story_id = p_story_id)::int
  from editorial.consents k
  join editorial.contributors c on c.id = k.contributor_id
  where k.story_id = p_story_id
    and public.usr_is_editorial();
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

  execute format(
    'update editorial.consents set %I = $2, confirmed_at = case when $2 then confirmed_at else null end where story_id = $1',
    p_field
  ) using p_story_id, p_value;
end;
$$;

-- A story may only be published once every box is ticked. This is the gate the
-- Write screen shows and the publish action enforces.
create or replace function public.edt_consent_complete(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.may_tell_story and k.may_publish_anonymously
            and k.details_changed and k.may_publish_in_parts
     from editorial.consents k where k.story_id = p_story_id),
    false
  );
$$;

revoke execute on function public.edt_story_consent(uuid) from public;
revoke execute on function public.edt_set_consent(uuid, text, boolean) from public;
revoke execute on function public.edt_consent_complete(uuid) from public;
grant execute on function public.edt_story_consent(uuid) to authenticated;
grant execute on function public.edt_set_consent(uuid, text, boolean) to authenticated;
grant execute on function public.edt_consent_complete(uuid) to authenticated;
