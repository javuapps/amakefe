import { formatCount, formatDate, formatKwacha, networkName, type Operator } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import {
  useSettlementAccount,
  useSettlements,
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
  const settlements = useSettlements()
  const account = useSettlementAccount()

  return (
    <div className="flex flex-col gap-6">
      <Async query={totals}>
        {(data) => (
          <>
            <div className="grid grid-cols-4 gap-4">
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
                        data.mobileOperator
                          ? networkName(data.mobileOperator as Operator)
                          : null,
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

      <Panel title="Payouts">
        <Async query={settlements}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-sm text-body">
                Nothing has been paid out yet. Every successful contribution is owed to you from the
                moment it clears.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Paid</th>
                    <th className="pb-2 font-normal">Reference</th>
                    <th className="pb-2 font-normal">Covering</th>
                    <th className="pb-2 font-normal">To</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3">{formatDate(row.settledAt)}</td>
                      <td className="text-muted">{row.transferReference ?? row.reference}</td>
                      <td>
                        {formatCount(row.paymentCount)} payment
                        {row.paymentCount === 1 ? '' : 's'} to {formatDate(row.periodTo)}
                      </td>
                      <td>{row.destination}</td>
                      <td className="text-right tabular-nums">{formatKwacha(row.netMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <table className="w-full text-sm">
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
            )
          }
        </Async>
      </Panel>
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
