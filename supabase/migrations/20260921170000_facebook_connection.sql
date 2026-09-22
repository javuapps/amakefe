-- Connecting the Facebook Page, and posting to it.
--
-- Adapted from twig's `sec_creator_oauth_tokens` + `oauth-callback` pair, with
-- three deliberate departures, because the two products are not shaped alike:
--
-- 1. **One connection, not one per user.** twig is multi-tenant and keys tokens
--    by `creator_id`. Here there is one creator and one Page — the platform's
--    own — so a per-user table would invent a dimension the product does not
--    have. At most one row is active at a time.
--
-- 2. **Nobody can read the token. Not even an editor.** twig lets a creator
--    select their own row, token column included. A Page token that can post to
--    200,000 followers is the most dangerous secret in this system, and the
--    studio never needs it: only the Edge Functions do, and they hold the
--    service-role key. So RLS is on with *no policy at all* — every client role
--    is refused, and `cnt_facebook_status()` hands the studio the page's name
--    and health without ever touching `access_token`.
--
-- 3. **The web studio, not a mobile deep link.** twig redirects to
--    `twigapp://oauth/callback`; this returns to the studio's own URL.

create table public.cnt_facebook_connection (
  id                uuid primary key default gen_random_uuid(),
  page_id           text not null,
  page_name         text not null,
  page_avatar_url   text,
  -- Written and read only by Edge Functions holding the service-role key.
  access_token      text not null,
  scopes            text[] not null default '{}',
  is_active         boolean not null default true,
  connected_at      timestamptz not null default now(),
  last_validated_at timestamptz,
  last_error        text,
  updated_at        timestamptz not null default now()
);

-- One live connection. A second Page means disconnecting the first, which is a
-- decision someone makes rather than a state the table drifts into.
create unique index cnt_facebook_connection_one_active
  on public.cnt_facebook_connection ((true)) where is_active;

alter table public.cnt_facebook_connection enable row level security;
-- No policies, on purpose. See note 2 above.

-- The page list from Meta, held across the redirect while the creator chooses
-- which Page to connect. Short-lived, and it holds page tokens, so it is as
-- closed as the table above.
create table public.cnt_facebook_pending (
  id          uuid primary key default gen_random_uuid(),
  user_token  text not null,
  pages       jsonb not null,
  expires_at  timestamptz not null default now() + interval '15 minutes',
  created_at  timestamptz not null default now()
);

alter table public.cnt_facebook_pending enable row level security;

-- ---------------------------------------------------------------------------
-- What the studio may know
-- ---------------------------------------------------------------------------

/** The connection's name and health. Never its token. */
create or replace function public.cnt_facebook_status()
returns table (
  page_id text,
  page_name text,
  page_avatar_url text,
  is_active boolean,
  connected_at timestamptz,
  last_validated_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.page_id, c.page_name, c.page_avatar_url, c.is_active,
         c.connected_at, c.last_validated_at, c.last_error
  from public.cnt_facebook_connection c
  where public.usr_is_editorial()
  order by c.connected_at desc
  limit 1;
$$;

/**
 * The Pages waiting to be chosen from, by name only — the access token each one
 * carries stays on the server, and the picker does not need it to name a Page.
 */
create or replace function public.cnt_facebook_pending_pages(p_pending_id uuid)
returns table (page_id text, page_name text, page_avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select page->>'id', page->>'name', page->>'picture_url'
  from public.cnt_facebook_pending p,
       lateral jsonb_array_elements(p.pages) as page
  where p.id = p_pending_id
    and p.expires_at > now()
    and public.usr_is_editorial();
$$;

/** Forgets the Page. The token goes with the row; nothing is kept for later. */
create or replace function public.cnt_facebook_disconnect()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usr_is_editorial() then raise exception 'not permitted'; end if;
  delete from public.cnt_facebook_connection;
end;
$$;

revoke execute on function public.cnt_facebook_status() from public, anon;
revoke execute on function public.cnt_facebook_pending_pages(uuid) from public, anon;
revoke execute on function public.cnt_facebook_disconnect() from public, anon;
grant execute on function public.cnt_facebook_status() to authenticated;
grant execute on function public.cnt_facebook_pending_pages(uuid) to authenticated;
grant execute on function public.cnt_facebook_disconnect() to authenticated;

-- ---------------------------------------------------------------------------
-- Publications the worker should send
-- ---------------------------------------------------------------------------

-- The worker polls this. `scheduled_for` null means "as soon as you can", which
-- is what "Post now" produces.
create index cnt_publications_due_facebook_idx
  on public.cnt_publications (scheduled_for nulls first)
  where channel = 'facebook' and status = 'planned';
