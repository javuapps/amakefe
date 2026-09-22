-- pg_net lives in schema `net`, not in `extensions`.
--
-- `20260921180000` called `extensions.net.http_post(...)`. Postgres reads a
-- three-part name as database.schema.function, so that is a reference to a
-- database called `extensions` and it raises
--
--   cross-database references are not implemented
--
-- every time it is reached. It was never reached: the function returns early
-- when nothing is due, and nothing was ever due, so the cron job reported 49
-- consecutive successes while carrying a line that could not run. The first
-- genuinely scheduled Facebook post would have been the first failure.
--
-- `create extension ... with schema extensions` did not move it either — pg_net
-- was already installed in `net`, so `if not exists` skipped the statement and
-- the misleading qualification survived into the function body.

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

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.cnt_send_due_facebook_posts() from public, anon, authenticated;
