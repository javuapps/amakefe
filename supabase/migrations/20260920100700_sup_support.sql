-- Support module.
--
-- The ledger the spec asks for in §59: every contribution is a row here, and the
-- payment provider's records are reconciled against it rather than trusted as the
-- source of truth.
--
-- Readers cannot insert into this table. A client that could write its own
-- payment rows could write its own amounts, so rows are created server-side by
-- the Edge Function that talks to the payment provider. That function is not
-- written yet — it needs mobile money merchant credentials.

create type public.sup_status as enum (
  'pending',
  'successful',
  'failed',
  'reversed',
  'refunded'
);

create table public.sup_transactions (
  id                 uuid primary key default gen_random_uuid(),
  -- Nullable: someone can support without ever having acted in the app, and a
  -- reader who supports is still anonymous.
  user_id            uuid references auth.users (id) on delete set null,
  amount_minor       integer not null check (amount_minor > 0),
  currency           char(3) not null default 'ZMW',
  is_monthly         boolean not null default false,
  provider           text not null,
  provider_reference text,
  status             public.sup_status not null default 'pending',
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  -- Idempotency: a provider webhook delivered twice must not bank twice.
  unique (provider, provider_reference)
);

create index sup_transactions_user_idx on public.sup_transactions (user_id, created_at desc);
create index sup_transactions_status_idx on public.sup_transactions (status, created_at desc);

alter table public.sup_transactions enable row level security;

-- Support history on the reader's own profile. No insert or update policy: those
-- happen through the service role inside an Edge Function.
create policy sup_transactions_read_own
  on public.sup_transactions for select to authenticated
  using (user_id = (select auth.uid()));

create policy sup_transactions_staff_read
  on public.sup_transactions for select to authenticated
  using (public.usr_is_staff());

-- The Support screen shows how many people support the community. A definer
-- function rather than a view, so it can count across all rows while exposing
-- nothing but the total.
create or replace function public.sup_supporter_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct coalesce(user_id::text, provider_reference))::int
  from public.sup_transactions
  where status = 'successful';
$$;

revoke execute on function public.sup_supporter_count() from public;
grant execute on function public.sup_supporter_count() to anon, authenticated;
