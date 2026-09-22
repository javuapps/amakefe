-- Every payment callback is kept, whether or not it was believed.
--
-- From cora_bot's pmt_webhook_events. Stored before it is acted on, signature
-- verdict included, because when a payment is disputed what the provider
-- actually sent is the evidence — not our reading of it.
--
-- A rejected callback is stored too, and that is the point of the partial index
-- below: "a webhook arrived and was refused" and "no webhook ever arrived" look
-- identical from every other screen, and they are very different problems. A
-- burst of rejections is what an attempt to forge settlements looks like.

create table public.sup_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'lenco',
  event           text,
  reference       text,
  signature_valid boolean not null,
  raw_body        text not null,
  headers         jsonb,
  processed_at    timestamptz,
  process_error   text,
  created_at      timestamptz not null default now()
);

create index sup_webhook_events_reference on public.sup_webhook_events (reference, created_at desc);
create index sup_webhook_events_rejected on public.sup_webhook_events (created_at desc)
  where not signature_valid;

alter table public.sup_webhook_events enable row level security;

-- Operators investigate payments; nobody else has any business in here, and
-- there is no insert policy because only the Edge Function writes it.
create policy sup_webhook_events_operator_read
  on public.sup_webhook_events for select
  to authenticated
  using (public.usr_is_operator());

/**
 * Settles a collection from a callback or the reconciler, once.
 *
 * The webhook and the poller race by design — whichever learns first wins, and
 * the other must not undo it. So this only ever moves a payment out of
 * `pending`, and a second arrival with the same outcome is a no-op rather than
 * a second settlement. Returns whether it changed anything, which is what the
 * caller logs.
 *
 * A successful collection becomes money she is owed in the same statement that
 * marks it successful: two writes could leave a payment banked and unowed.
 */
create or replace function public.sup_settle_collection(
  p_reference text,
  p_successful boolean,
  p_provider_reference text default null,
  p_raw jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  update public.sup_transactions
     set status             = case when p_successful then 'successful' else 'failed' end::public.sup_status,
         completed_at       = now(),
         provider_reference = coalesce(p_provider_reference, provider_reference),
         raw_provider_json  = coalesce(p_raw, raw_provider_json),
         settlement_status  = case
                                when p_successful then 'pending'
                                else settlement_status
                              end::public.sup_settlement_status
   where internal_reference = p_reference
     and status = 'pending';

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.sup_settle_collection(text, boolean, text, jsonb)
  from public, anon, authenticated;
