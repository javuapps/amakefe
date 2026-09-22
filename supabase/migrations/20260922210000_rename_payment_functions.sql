-- The payment functions are named for the provider they talk to.
--
-- They were support-start, support-webhook and support-reconcile, named after
-- the `sup_` module. That was wrong in a way that only shows up later: all
-- three speak Lenco's API directly — its endpoints, its payload shapes, its
-- status vocabulary — and a second provider would want its own set rather than
-- a branch inside each of these. The webhook is the sharpest case, since its
-- URL lives in Lenco's dashboard and renaming it after it has been registered
-- costs a window of callbacks that 404 while payments quietly stop settling.
--
-- Renamed while the URL had been given to nobody, which is the only free moment
-- to do it.

create or replace function public.sup_reconcile_due()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_url text := 'https://rubukvxtiezyfxzqacsi.supabase.co/functions/v1/lenco-reconcile';
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    return;
  end if;

  if not exists (
    select 1 from public.sup_transactions where status = 'pending'
  ) then
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

revoke execute on function public.sup_reconcile_due() from public, anon, authenticated;

select cron.unschedule('support-reconcile');
select cron.schedule(
  'lenco-reconcile',
  '*/2 * * * *',
  $$select public.sup_reconcile_due();$$
);
