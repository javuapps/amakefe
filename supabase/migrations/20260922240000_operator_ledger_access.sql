-- The ledger has two audiences, and `usr_is_staff()` is no longer either of them
-- on its own.
--
-- `sup_transactions` was readable by staff, where "staff" meant a role and
-- nothing else. Now that a gate asks which application an account belongs to,
-- `usr_is_staff()` means *editorial* — so the operators, whose entire job is
-- this table, lost it. Caught by reading the ledger with a real operator token
-- and getting an empty array back with a live payment sitting in it.
--
-- Both audiences are named explicitly rather than widening `usr_is_staff()`
-- back out. She reads this to see what she is owed; they read it to process it.
-- They are different people with different applications, and a single predicate
-- covering both would be the thing this identity model exists to stop.
create policy sup_transactions_operator_read
  on public.sup_transactions for select to authenticated
  using (public.usr_is_operator());

-- Same split for the two tables that were operator-write but staff-read. The
-- write halves already ask `usr_is_operator()`; these give them the read.
create policy sup_accounts_operator_read
  on public.sup_settlement_accounts for select to authenticated
  using (public.usr_is_operator());

create policy sup_settlements_operator_read
  on public.sup_settlements for select to authenticated
  using (public.usr_is_operator());

-- `sup_totals()` was SECURITY DEFINER, granted to `authenticated`, and asked
-- nothing about the caller — so every signed-in reader could read the
-- platform's entire revenue, commission and outstanding balance through one
-- RPC. The grant was doing all the work and the grant is to everyone who has
-- ever saved a story.
--
-- It stays definer, because it must aggregate a table its callers read only
-- parts of; the check moves inside, where it belongs.
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.usr_is_staff() or public.usr_is_operator()) then
    raise exception 'not permitted';
  end if;

  return query
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
end;
$$;

revoke execute on function public.sup_totals() from public, anon;
grant execute on function public.sup_totals() to authenticated;
