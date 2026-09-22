-- Supporting the community becomes real money.
--
-- Adapted from ginni's pmt_* engine (migrations 028–054 there), with one
-- deliberate inversion.
--
-- **Ginni's fee is added on top and borne by the payer**: a K100 school fee is a
-- K101.50 prompt, the school is settled K100, Ginni keeps K1.50. `amount` stays
-- the school's money, and `charged_amount` is generated from it.
--
-- **Here the commission comes out of what was given.** A supporter chooses K50
-- and is charged K50; the platform keeps 20% for tech and operations and Amake
-- Fe is settled K40. So `amount_minor` keeps meaning exactly what it already
-- meant — what the supporter paid — and the creator's figure is the generated
-- one. Every existing reader of `amount_minor` therefore stays correct, which is
-- the property ginni's comment is really about: the column that screens already
-- read must not quietly come to mean something else.
--
-- The rate is snapshotted per row. Changing it later never rewrites what was
-- already taken, or what somebody has already been settled.

-- ---------------------------------------------------------------------------
-- The commission
-- ---------------------------------------------------------------------------

/**
 * 20%, in basis points, and the arithmetic that applies it.
 *
 * Integer ngwee throughout — a percentage of money held as a float is how a
 * ledger stops balancing. Rounded half up, and the net is whatever is left, so
 * commission + net is always exactly what the supporter paid with nothing lost
 * to rounding in between.
 */
create function public.sup_commission_minor(p_amount_minor int, p_rate_bps int)
returns int
language sql
immutable
set search_path = ''
as $$
  select round((p_amount_minor::numeric * p_rate_bps) / 10000)::int;
$$;

alter table public.sup_transactions
  add column commission_rate_bps int not null default 2000
    check (commission_rate_bps between 0 and 10000),
  add column commission_minor int not null default 0
    check (commission_minor >= 0),
  -- What Amake Fe is owed for this payment. Generated, so it can never disagree
  -- with the two figures it sits between.
  add column net_minor int generated always as (amount_minor - commission_minor) stored,

  -- Who paid and on what rail. The number actually debited, not the account that
  -- asked — someone supporting from a relative's phone is ordinary.
  add column operator text,
  add column payer_mobile text,
  add column payer_name text,

  -- Our reference, generated before the money moves, so a payment is traceable
  -- from either end even when the provider has never heard of it.
  add column internal_reference text,

  -- The hosted page the supporter was sent to. Stored rather than returned and
  -- forgotten: someone who closes the tab can be given the same link again.
  add column checkout_url text,

  -- After this, stop asking. A prompt nobody answered is not pending forever,
  -- and without a deadline the reconciler works through a growing list of
  -- payments that will never complete.
  add column expires_at timestamptz,

  -- What the provider actually said. When a supporter insists they paid and the
  -- provider says otherwise, the body settles it, not our reading of it.
  add column raw_provider_json jsonb,

  add constraint sup_commission_within_amount check (commission_minor <= amount_minor);

create unique index sup_transactions_internal_ref on public.sup_transactions (internal_reference)
  where internal_reference is not null;

-- Drives the reconciler, and is the only query that asks this question.
create index sup_transactions_inflight on public.sup_transactions (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Who the operators are
-- ---------------------------------------------------------------------------

/**
 * Platform staff, as distinct from Amake Fe and her editors.
 *
 * `finance` already existed in usr_role and was never used; this is the job it
 * was named for. Operators settle her — so they are deliberately not the same
 * set as `usr_is_editorial()`, and an editor cannot record a payout any more
 * than an operator can publish a story.
 */
create or replace function public.usr_is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usr_roles r
    where r.user_id = (select auth.uid()) and r.role in ('finance', 'super_admin')
  );
$$;

revoke execute on function public.usr_is_operator() from public, anon;
grant execute on function public.usr_is_operator() to authenticated;

-- ---------------------------------------------------------------------------
-- Where Amake Fe is paid
-- ---------------------------------------------------------------------------

create type public.sup_account_kind as enum ('bank', 'mobile_money');

/**
 * Recorded by operators, never by her.
 *
 * Letting the party that receives the money choose where it goes is the classic
 * way money goes somewhere else. One live account at a time; a change retires
 * the old row rather than editing it, so every settlement can still say which
 * account it actually paid.
 */
create table public.sup_settlement_accounts (
  id              uuid primary key default gen_random_uuid(),
  kind            public.sup_account_kind not null,
  account_name    text not null check (length(btrim(account_name)) > 0),
  bank_name       text,
  branch          text,
  account_number  text,
  mobile_operator text,
  mobile_number   text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  retired_at      timestamptz,
  retired_by      uuid references auth.users (id) on delete set null,
  constraint sup_account_bank
    check (kind <> 'bank' or (bank_name is not null and account_number is not null)),
  constraint sup_account_mobile
    check (kind <> 'mobile_money' or (mobile_operator is not null and mobile_number is not null))
);

-- One live account, enforced rather than remembered.
create unique index sup_settlement_accounts_live
  on public.sup_settlement_accounts ((true)) where retired_at is null;

-- ---------------------------------------------------------------------------
-- A settlement
-- ---------------------------------------------------------------------------

create table public.sup_settlements (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  -- Generated when the operator opens the form. The same confirmation sent
  -- twice — a double click, a retried request — is one settlement, not two
  -- payouts recorded for one transfer.
  idempotency_key uuid not null unique,
  period_from     date not null,
  period_to       date not null,
  payment_count   int not null check (payment_count > 0),
  gross_minor     int not null,
  commission_minor int not null,
  net_minor       int not null,

  -- Snapshots. A settlement is a record of what happened, and an account
  -- changed next month must not rewrite a statement already issued.
  account_id      uuid references public.sup_settlement_accounts (id) on delete set null,
  account_kind    public.sup_account_kind not null,
  account_name    text not null,
  bank_name       text,
  branch          text,
  account_number  text,
  mobile_operator text,
  mobile_number   text,

  -- The bank or mobile money reference of the transfer itself, when the
  -- operator has it.
  transfer_reference text,
  notes           text,
  settled_by      uuid references auth.users (id) on delete set null,
  settled_at      timestamptz not null default now(),
  constraint sup_settlements_period check (period_from <= period_to)
);

create index sup_settlements_recent on public.sup_settlements (settled_at desc);

-- ---------------------------------------------------------------------------
-- Each payment's settlement
-- ---------------------------------------------------------------------------

create type public.sup_settlement_status as enum ('not_applicable', 'pending', 'settled');

alter table public.sup_transactions
  add column settlement_status public.sup_settlement_status not null default 'not_applicable',
  add column settlement_id uuid references public.sup_settlements (id) on delete restrict,
  add constraint sup_settlement_link
    check ((settlement_status = 'settled') = (settlement_id is not null));

create index sup_awaiting_settlement on public.sup_transactions (completed_at)
  where settlement_status = 'pending';
create index sup_by_settlement on public.sup_transactions (settlement_id)
  where settlement_id is not null;

-- Every collection that succeeded is money she is owed until a settlement says
-- otherwise. Nothing has been taken yet, so this moves no rows today — it is
-- here so the rule is stated where the column is created.
update public.sup_transactions
   set settlement_status = 'pending'
 where status = 'successful';

-- ---------------------------------------------------------------------------
-- Who may see what
-- ---------------------------------------------------------------------------

alter table public.sup_settlement_accounts enable row level security;
alter table public.sup_settlements         enable row level security;

-- She may see where she is paid and what she has been paid. She may not change
-- either: recording an account and recording a payout are the operator's, and
-- the whole point of the split is that the party being paid does not control
-- the destination.
create policy sup_accounts_read_staff
  on public.sup_settlement_accounts for select
  to authenticated
  using (public.usr_is_staff());

create policy sup_accounts_operator_write
  on public.sup_settlement_accounts for all
  to authenticated
  using (public.usr_is_operator())
  with check (public.usr_is_operator());

create policy sup_settlements_read_staff
  on public.sup_settlements for select
  to authenticated
  using (public.usr_is_staff());

create policy sup_settlements_operator_write
  on public.sup_settlements for all
  to authenticated
  using (public.usr_is_operator())
  with check (public.usr_is_operator());

-- `sup_transactions` keeps its existing policies: a supporter reads their own
-- rows, staff read all, and nobody inserts — the rows are written by the Edge
-- Function that talks to the provider, holding the service-role key. A client
-- that could write its own payment rows could write its own amounts.

-- ---------------------------------------------------------------------------
-- What is owed, and what has been paid
-- ---------------------------------------------------------------------------

/**
 * The money as both sides need to see it.
 *
 * One row. She reads it on Supporters to know what is coming; operators read it
 * to know what to pay. `security definer` because it aggregates every row of a
 * table she can read but a supporter cannot, and it exposes totals only.
 */
create or replace function public.sup_totals()
returns table (
  supporters        int,
  collected_minor   bigint,
  commission_minor  bigint,
  net_minor         bigint,
  awaiting_minor    bigint,
  awaiting_count    int,
  settled_minor     bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(distinct coalesce(t.user_id::text, t.provider_reference))
       from public.sup_transactions t where t.status = 'successful')::int,
    coalesce(sum(t.amount_minor)     filter (where t.status = 'successful'), 0)::bigint,
    coalesce(sum(t.commission_minor) filter (where t.status = 'successful'), 0)::bigint,
    coalesce(sum(t.net_minor)        filter (where t.status = 'successful'), 0)::bigint,
    coalesce(sum(t.net_minor)        filter (where t.settlement_status = 'pending'), 0)::bigint,
    count(*) filter (where t.settlement_status = 'pending')::int,
    coalesce(sum(t.net_minor)        filter (where t.settlement_status = 'settled'), 0)::bigint
  from public.sup_transactions t;
$$;

revoke execute on function public.sup_totals() from public, anon;
grant execute on function public.sup_totals() to authenticated;

/**
 * Records a payout and marks what it covers, in one transaction.
 *
 * A settlement that banked half its payments would leave the rest owed forever,
 * so the batch and the rows move together or not at all. The idempotency key
 * makes a retried confirmation return the settlement it already created rather
 * than paying twice.
 */
create or replace function public.sup_settle(
  p_idempotency_key uuid,
  p_account_id uuid,
  p_transfer_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_account  public.sup_settlement_accounts%rowtype;
  v_id       uuid;
  v_count    int;
  v_gross    bigint;
  v_comm     bigint;
  v_net      bigint;
  v_from     date;
  v_to       date;
begin
  if not public.usr_is_operator() then
    raise exception 'not permitted';
  end if;

  select id into v_existing from public.sup_settlements where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_account from public.sup_settlement_accounts where id = p_account_id;
  if v_account.id is null then
    raise exception 'no such settlement account';
  end if;

  select count(*), coalesce(sum(amount_minor), 0), coalesce(sum(commission_minor), 0),
         coalesce(sum(net_minor), 0), min(completed_at)::date, max(completed_at)::date
    into v_count, v_gross, v_comm, v_net, v_from, v_to
    from public.sup_transactions
   where settlement_status = 'pending';

  if v_count = 0 then
    raise exception 'nothing is awaiting settlement';
  end if;

  insert into public.sup_settlements (
    reference, idempotency_key, period_from, period_to, payment_count,
    gross_minor, commission_minor, net_minor,
    account_id, account_kind, account_name, bank_name, branch, account_number,
    mobile_operator, mobile_number, transfer_reference, notes, settled_by
  ) values (
    'STL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6),
    p_idempotency_key, v_from, v_to, v_count,
    v_gross, v_comm, v_net,
    v_account.id, v_account.kind, v_account.account_name, v_account.bank_name,
    v_account.branch, v_account.account_number, v_account.mobile_operator,
    v_account.mobile_number, p_transfer_reference, p_notes, (select auth.uid())
  ) returning id into v_id;

  update public.sup_transactions
     set settlement_status = 'settled', settlement_id = v_id
   where settlement_status = 'pending';

  return v_id;
end;
$$;

revoke execute on function public.sup_settle(uuid, uuid, text, text) from public, anon;
grant execute on function public.sup_settle(uuid, uuid, text, text) to authenticated;
