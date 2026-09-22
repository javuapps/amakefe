-- How a supporter learns whether their payment went through.
--
-- Mobile money is asynchronous: `lenco-collect` returns the moment the handset
-- has been prompted, and the answer arrives later on the webhook. The screen
-- therefore has to ask, and it cannot ask the table.
--
-- `sup_transactions` is readable only by its owner or by staff, and supporting
-- has never required an account — most supporters arrive from a Facebook post
-- with no session at all. Their row has `user_id` null and no policy can reach
-- it. Signing them in to take their money would put a wall exactly where the
-- funnel cannot afford one.
--
-- So the internal reference is the capability. It is 18 characters of a random
-- UUID, minted server-side in `lenco-collect` and returned to that one caller;
-- it is not listed anywhere and cannot be enumerated. Holding it proves you are
-- the browser that started the payment, which is the only claim being made.
--
-- What it hands back is deliberately thin — the status, the amount, the network
-- and when it was settled. No phone number, no name, no user id, no provider
-- payload: a reference that leaked would reveal that someone gave ZMW 50 on
-- MTN, and nothing about who.
create or replace function public.sup_collection_status(p_reference text)
returns table (
  status       public.sup_status,
  amount_minor integer,
  operator     text,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.status, t.amount_minor, t.operator, t.completed_at
  from public.sup_transactions t
  where t.internal_reference = p_reference;
$$;

revoke execute on function public.sup_collection_status(text) from public;
grant execute on function public.sup_collection_status(text) to anon, authenticated;
