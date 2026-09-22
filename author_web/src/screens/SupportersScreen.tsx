import { formatCount, formatDate } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { useDashboardStats, useSupportTransactions } from '../hooks/queries'

export function SupportersScreen() {
  const stats = useDashboardStats()
  const transactions = useSupportTransactions()

  return (
    <div className="flex flex-col gap-6">
      <Async query={stats}>
        {(data) =>
          data && (
            <div className="grid grid-cols-3 gap-4">
              <Stat
                label="This month"
                value={`ZMW ${formatCount(Math.round(data.monthlySupportMinor / 100))}`}
              />
              <Stat label="Supporters" value={formatCount(data.supporters)} />
              <Stat label="Readers this week" value={formatCount(data.weeklyReaders)} />
            </div>
          )
        }
      </Async>

      <Panel title="Recent contributions">
        <Async query={transactions}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="text-sm text-body">
                <p>No contributions yet.</p>
                <p className="mt-2 text-muted">
                  The ledger is in place, but nothing can be banked until a mobile money provider is
                  connected. Contributions are written server-side from the provider&rsquo;s webhook —
                  never by the app — so that no client can invent an amount.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">Provider</th>
                    <th className="pb-2 font-normal">Type</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3">{formatDate(row.createdAt)}</td>
                      <td className="capitalize">{row.provider}</td>
                      <td>{row.isMonthly ? 'Monthly' : 'One-off'}</td>
                      <td className="capitalize">{row.status}</td>
                      <td className="text-right tabular-nums">
                        {row.currency} {formatCount(Math.round(row.amountMinor / 100))}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line-card bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 font-display text-[26px] text-ink">{value}</div>
    </div>
  )
}
