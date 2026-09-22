-- The reconciler runs every two minutes.
--
-- Not every minute: a mobile money prompt takes a while to be answered, and
-- asking the provider about the same payment sixty times an hour is rude and
-- rate-limited. Not every ten either — a supporter watching a spinner should
-- not wait that long to be told it worked.
--
-- Same shape as `facebook-due`, and the same two traps avoided: `net.http_post`
-- lives in schema `net`, and the key comes from Vault rather than this file.

create or replace function public.sup_reconcile_due()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_url text := 'https://rubukvxtiezyfxzqacsi.supabase.co/functions/v1/support-reconcile';
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    return;
  end if;

  -- Nothing waiting, nothing to wake.
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

select cron.schedule(
  'support-reconcile',
  '*/2 * * * *',
  $$select public.sup_reconcile_due();$$
);
