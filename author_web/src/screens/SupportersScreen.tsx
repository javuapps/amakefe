import { useState } from 'react'
import {
  formatCount,
  formatDate,
  formatKwacha,
  networkName,
  placementName,
  type Operator,
  type Settlement,
} from '@amakefe/core'
import { SettlementStatement } from '@amakefe/ui'
import { Async, Panel } from '../components/shell'
import {
  useDownloadStatement,
  useSettlementAccount,
  useSettlementPayments,
  useSettlements,
  useSupportPlacements,
  useSupportTotals,
  useSupportTransactions,
} from '../hooks/queries'

/**
 * Her side of the money, and it is read-only on purpose.
 *
 * Supporters pay the platform; operators settle her the net after commission.
 * She can see every figure — what came in, what was deducted, what is owed and
 * what has been paid, into which account — and can change none of it. The party
 * being paid does not record the payout or choose the destination; that split
 * is the whole reason the operator console is a separate application.
 */
export function SupportersScreen() {
  const totals = useSupportTotals()
  const transactions = useSupportTransactions()
  const placements = useSupportPlacements()
  const settlements = useSettlements()
  const account = useSettlementAccount()
  const [viewing, setViewing] = useState<Settlement | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Async query={totals}>
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Supporters" value={formatCount(data.supporters)} />
              <Stat label="Given in total" value={formatKwacha(data.collectedMinor)} />
              <Stat label="Yours so far" value={formatKwacha(data.netMinor)} />
              <Stat
                label="Awaiting payout"
                value={formatKwacha(data.awaitingMinor)}
                note={
                  data.awaitingCount > 0
                    ? `${formatCount(data.awaitingCount)} payment${data.awaitingCount === 1 ? '' : 's'}`
                    : undefined
                }
              />
            </div>
            <p className="-mt-2 text-xs text-muted">
              Supporters give {formatKwacha(data.collectedMinor)}; {formatKwacha(data.commissionMinor)}{' '}
              of that is the platform&rsquo;s 20% for the payment rails, hosting and operations, and{' '}
              {formatKwacha(data.settledMinor)} has been paid out so far.
            </p>
          </>
        )}
      </Async>

      <Panel title="Where you are paid">
        <Async query={account}>
          {(data) =>
            data ? (
              <div className="text-sm text-body">
                <p className="text-ink">{data.accountName}</p>
                <p className="mt-1">
                  {data.kind === 'bank'
                    ? [data.bankName, data.branch, data.accountNumber].filter(Boolean).join(' · ')
                    : [
                        data.mobileOperator ? networkName(data.mobileOperator as Operator) : null,
                        data.mobileNumber,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Recorded by the platform operators. Ask them to change it — an account the
                  recipient can edit is how money ends up somewhere else.
                </p>
              </div>
            ) : (
              <p className="text-sm text-body">
                No payout account recorded yet. The platform operators add it before the first
                settlement.
              </p>
            )
          }
        </Async>
      </Panel>

      {/* Her number is the net, like the "Yours" column below — the gross is
          the platform's to reconcile, not hers to read twice. */}
      <Panel title="Where support comes from">
        <Async query={placements}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing has come in yet.</p>
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
                      <span className="tabular-nums text-ink">{formatKwacha(row.netMinor)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
        <p className="pt-3 text-xs text-muted">
          Which ask people answer. Every story stays free wherever they answer it.
        </p>
      </Panel>

      <Panel title="Payouts">
        <Async query={settlements}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-sm text-body">
                Nothing has been paid out yet. Every successful contribution is owed to you from the
                moment it clears.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <PayoutRow key={row.id} settlement={row} onOpen={() => setViewing(row)} />
                ))}
              </div>
            )
          }
        </Async>
      </Panel>

      <Panel title="Recent contributions">
        <Async query={transactions}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="text-sm text-body">
                <p>No contributions yet.</p>
                <p className="mt-2 text-muted">
                  Contributions are written server-side from the provider&rsquo;s webhook — never by
                  the app — so that no client can invent an amount.
                </p>
              </div>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">Network</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal">Payout</th>
                    <th className="pb-2 text-right font-normal">Given</th>
                    <th className="pb-2 text-right font-normal">Yours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3">{formatDate(row.createdAt)}</td>
                      <td>{row.operator ? networkName(row.operator) : row.provider}</td>
                      <td className="capitalize">{row.status}</td>
                      <td className="text-muted">
                        {row.settlementStatus === 'settled'
                          ? 'Paid out'
                          : row.settlementStatus === 'pending'
                            ? 'Owed to you'
                            : '—'}
                      </td>
                      <td className="text-right tabular-nums">{formatKwacha(row.amountMinor)}</td>
                      <td className="text-right tabular-nums">
                        {row.status === 'successful' ? formatKwacha(row.netMinor) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </Async>
      </Panel>

      {viewing && <Statement settlement={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border border-line-card bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 font-display text-[22px] text-ink">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  )
}

/** One payout she received. Clicking it opens the statement. */
function PayoutRow({ settlement, onOpen }: { settlement: Settlement; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-card border border-line-card p-4 text-left transition-colors hover:border-line-strong"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{formatKwacha(settlement.netMinor)}</span>
        <span className="block text-xs text-muted">
          {formatDate(settlement.settledAt)} · {formatCount(settlement.paymentCount)} payment
          {settlement.paymentCount === 1 ? '' : 's'} · into {settlement.destination}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted">
        {settlement.transferReference ?? settlement.reference}
      </span>
      <span className="shrink-0 text-xs text-muted" aria-hidden>
        ›
      </span>
    </button>
  )
}

/**
 * The statement, which is the operators' statement.
 *
 * The same component and the same PDF they hold — there is no version of this
 * document that only one side has. "Yours" rather than "Settled" on the last
 * column, because that is what the number is to her.
 */
function Statement({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  const payments = useSettlementPayments(settlement.id)
  const download = useDownloadStatement()

  return (
    <SettlementStatement
      settlement={settlement}
      payments={payments.data ?? null}
      netLabel="Yours"
      onClose={onClose}
      action={
        <button
          type="button"
          onClick={() => download.mutate(settlement)}
          disabled={download.isPending}
          className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink disabled:opacity-40"
        >
          {download.isPending ? 'Preparing…' : download.isError ? 'Try again' : 'Download PDF'}
        </button>
      }
    />
  )
}
