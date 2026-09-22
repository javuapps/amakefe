-- Sending the Facebook post: now, or when the part goes live.
--
-- Publishing immediately posts synchronously — the studio calls `facebook-post`
-- with the publication's id and waits, so a refusal from Facebook is something
-- the writer sees while she can still do something about it. A cron that ran a
-- minute later would hide it.
--
-- Only a *scheduled* part needs a background job, and that is what this sets up.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- What is due
-- ---------------------------------------------------------------------------

/**
 * Planned Facebook posts whose part has gone live.
 *
 * The gate is the part's own `published_at`, not `cnt_publications.scheduled_for`.
 * The two say the same thing at the moment of scheduling and then drift: moving
 * a part to Thursday updates the part, and a copy of the old time on the
 * publication would send the post on Tuesday to a story nobody can read yet.
 * One source of truth, the same one RLS uses to decide what readers can see.
 */
create or replace function public.cnt_facebook_due()
returns table (id uuid, payload jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.payload
  from public.cnt_publications p
  join public.cnt_story_parts sp on sp.id = p.part_id
  where p.channel = 'facebook'
    and p.status = 'planned'
    and sp.published_at is not null
    and sp.published_at <= now()
  order by sp.published_at
  limit 25;
$$;

revoke execute on function public.cnt_facebook_due() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The minute hand
-- ---------------------------------------------------------------------------

/**
 * Nudges the `facebook-post` Edge Function.
 *
 * The service-role key lives in Vault rather than in this file, because a
 * migration is committed to the repository and that key posts as the platform.
 * Until someone stores it, this returns quietly instead of erroring every
 * minute in the Postgres log:
 *
 *   select vault.create_secret('<service-role-key>', 'service_role_key');
 */
create or replace function public.cnt_send_due_facebook_posts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_url text := 'https://rubukvxtiezyfxzqacsi.supabase.co/functions/v1/facebook-post';
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    return;
  end if;

  -- Nothing waiting, nothing to wake.
  if not exists (select 1 from public.cnt_facebook_due()) then
    return;
  end if;

  perform extensions.net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.cnt_send_due_facebook_posts() from public, anon, authenticated;

select cron.schedule(
  'facebook-due',
  '* * * * *',
  $$select public.cnt_send_due_facebook_posts();$$
);
