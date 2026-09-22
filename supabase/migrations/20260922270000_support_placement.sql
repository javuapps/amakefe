-- Where the ask was that somebody answered.
--
-- The ask now appears in more than one place: the Support screen, the card on
-- Home, the row on Profile, a rail beside Stories and Community, the end of a
-- story part, and under a community post. Knowing which of those brings
-- support in is the difference between a judgement and a guess about where to
-- put the next one — and, more usefully, about which of them to remove.
--
-- It is identity-free in the strongest sense. It names a PLACE on a screen and
-- cannot name a person, because there is nothing here to join a person to that
-- was not already on the row. It must never grow a referrer, a campaign or a
-- session id; that is how a column like this usually ends.
--
-- Nullable rather than defaulted. "We did not record where this came from" and
-- "this came from the Support screen" are different facts, and a default would
-- quietly turn every one of the first into the second.
--
-- Like every other column on this table it is written by the service role:
-- sup_transactions has no insert policy at all, and a client that could write
-- its own attribution could write its own amount.

create type public.sup_placement as enum (
    'support_screen',
    'home_card',
    'profile_row',
    'story_end',
    'community_post',
    'stories_rail',
    'community_rail'
);

alter table public.sup_transactions
    add column placement public.sup_placement;

comment on column public.sup_transactions.placement is
    'Which ask the supporter answered. Null when the collection named none, or '
    'named one this server does not know. It says where the button was, never '
    'who pressed it.';

-- The only question anyone asks of this column is asked grouped, over the
-- payments that actually completed.
create index if not exists sup_transactions_placement
    on public.sup_transactions (placement)
    where status = 'successful';

/**
 * What each ask has brought in.
 *
 * Payments, not people. `sup_totals()` counts distinct supporters because the
 * platform total means "how many of us are there"; one supporter giving from
 * Home in March and from the end of a story in April is two answers to two
 * asks, and has to read as two.
 *
 * The check is inside the function rather than on the grant, like
 * `sup_totals()`: the grant is to everyone who has ever saved a story, and
 * relying on it has already gone wrong here once (20260922240000).
 */
create or replace function public.sup_by_placement()
returns table (
    placement       public.sup_placement,
    payment_count   int,
    collected_minor bigint,
    net_minor       bigint
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
    select t.placement,
           count(*)::int,
           coalesce(sum(t.amount_minor), 0)::bigint,
           coalesce(sum(t.net_minor), 0)::bigint
      from public.sup_transactions t
     where t.status = 'successful'
     group by t.placement
     order by 3 desc nulls last;
end;
$$;

revoke execute on function public.sup_by_placement() from public, anon;
grant execute on function public.sup_by_placement() to authenticated;
