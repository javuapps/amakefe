import { useState } from 'react'
import {
  formatCount,
  formatDate,
  formatKwacha,
  localPhone,
  networkName,
  placementName,
  type Enums,
} from '@amakefe/core'
import { Async, Panel, Stat } from '../components/shell'
import { usePlacements, useReconcile, useTotals, useTransactions } from '../hooks/queries'

/**
 * The ledger, as the people who process it read it.
 *
 * This is the one screen in the platform that shows a supporter's phone number,
 * because reconciling a payment against a provider's records is exactly the job
 * that needs it. Nothing here is published anywhere.
 */
const FILTERS: Array<[Enums<'sup_status'> | 'all', string]> = [
  ['all', 'All'],
  ['pending', 'In flight'],
  ['successful', 'Successful'],
  ['failed', 'Failed'],
]

export function CollectionsScreen() {
  const [filter, setFilter] = useState<Enums<'sup_status'> | 'all'>('all')
  const totals = useTotals()
  const transactions = useTransactions(filter)
  const placements = usePlacements()
  const reconcile = useReconcile()

  return (
    <div className="flex flex-col gap-6">
      <Async query={totals}>
        {(data) => (
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Supporters" value={formatCount(data.supporters)} />
            <Stat label="Collected" value={formatKwacha(data.collectedMinor)} />
            <Stat label="Commission (20%)" value={formatKwacha(data.commissionMinor)} />
            <Stat
              label="Owed to the creator"
              value={formatKwacha(data.awaitingMinor)}
              note={`${formatCount(data.awaitingCount)} awaiting settlement`}
            />
          </div>
        )}
      </Async>

      <Panel title="Where support comes from">
        <Async query={placements}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="py-2 text-sm text-muted">No payments have settled yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {rows.map((row) => (
                  <li
                    key={row.placement ?? 'unrecorded'}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span>{placementName(row.placement)}</span>
                    <span className="text-muted">
                      {formatCount(row.paymentCount)} payments ·{' '}
                      <span className="tabular-nums text-ink">
                        {formatKwacha(row.collectedMinor)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
        {/* It counts payments an ask produced, never the readers who saw it
            and moved on — so it answers where support comes from and not
            which ask works hardest. */}
        <p className="pt-3 text-xs text-muted">
          Payments, not people, and no count of who saw each ask.
        </p>
      </Panel>

      <Panel
        title="Payments"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    filter === value
                      ? 'bg-ink text-surface-warm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* The cron already asks every two minutes. This is for the moment
                someone is looking at a payment and wants the answer now. */}
            <button
              type="button"
              onClick={() => reconcile.mutate()}
              disabled={reconcile.isPending}
              className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink disabled:opacity-40"
            >
              {reconcile.isPending ? 'Asking the provider…' : 'Check in-flight payments'}
            </button>
          </div>
        }
      >
        {reconcile.data && (
          <p className="mb-4 text-xs text-muted">
            Asked about {formatCount(reconcile.data.asked)}; {formatCount(reconcile.data.settled)}{' '}
            settled, {formatCount(reconcile.data.expired)} expired.
            {reconcile.data.reasons.length > 0 && ` ${reconcile.data.reasons.join('; ')}`}
          </p>
        )}
        {reconcile.isError && (
          <p className="mb-4 text-xs text-accent-deep">
            {reconcile.error instanceof Error ? reconcile.error.message : 'That did not run.'}
          </p>
        )}

        <Async query={transactions}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-sm text-body">Nothing here.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Started</th>
                    <th className="pb-2 font-normal">Reference</th>
                    <th className="pb-2 font-normal">Network</th>
                    <th className="pb-2 font-normal">From</th>
                    <th className="pb-2 font-normal">Number</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal">Payout</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                    <th className="pb-2 text-right font-normal">Commission</th>
                    <th className="pb-2 text-right font-normal">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="text-muted">{row.reference}</td>
                      <td>{row.operator ? networkName(row.operator) : row.provider}</td>
                      <td className="text-muted">{placementName(row.placement)}</td>
                      <td className="tabular-nums">
                        {row.payerMobile ? localPhone(row.payerMobile) : '—'}
                      </td>
                      <td className="capitalize">{row.status}</td>
                      <td className="text-muted">
                        {row.settlementStatus === 'settled'
                          ? 'Settled'
                          : row.settlementStatus === 'pending'
                            ? 'Owed'
                            : '—'}
                      </td>
                      <td className="text-right tabular-nums">{formatKwacha(row.amountMinor)}</td>
                      <td className="text-right tabular-nums text-muted">
                        {formatKwacha(row.commissionMinor)}
                      </td>
                      <td className="text-right tabular-nums">{formatKwacha(row.netMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Async>
      </Panel>
    </div>
  )
}
