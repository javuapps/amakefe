import { useEffect, type ReactNode } from 'react'
import {
  formatCount,
  formatDate,
  formatKwacha,
  networkName,
  type Settlement,
  type SupportTransaction,
} from '@amakefe/core'

/**
 * A payout, in full.
 *
 * Shared rather than written twice, for the reason the PDF is rendered once:
 * the operator who recorded the payout and the creator who received it are
 * looking at the same event, and two components describing it are two things
 * that agree until one of them is changed. The only difference between the two
 * sides is the word for the last column, which is why it is a prop.
 *
 * It fills the screen because a statement is a document, not a row — and the
 * list behind it is not something anyone needs while reading one.
 */
export function SettlementStatement({
  settlement,
  payments,
  netLabel = 'Settled',
  onClose,
  action,
}: {
  settlement: Settlement
  /** Null while they are still loading; the totals are on the snapshot anyway. */
  payments: SupportTransaction[] | null
  /** "Settled" to the operators who paid it; "Yours" to the creator who got it. */
  netLabel?: string
  onClose: () => void
  /** The Download button, which each app wires to its own mutation. */
  action?: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // The page must not scroll underneath while this is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-ink/50"
      role="dialog"
      aria-modal="true"
      aria-label={`Settlement ${settlement.reference}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex h-full w-full flex-col bg-surface">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-8 py-[18px]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Settlement statement
            </div>
            <h2 className="mt-[3px] font-display text-[21px] leading-tight text-ink">
              {formatKwacha(settlement.netMinor)} to {settlement.accountName}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {action}
            <button type="button" onClick={onClose} className="text-sm text-body">
              Close
            </button>
          </div>
        </header>

        {/* One scroll region, as everywhere else in the studio. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          <div className="mx-auto flex max-w-3xl flex-col gap-7">
            <section className="grid grid-cols-2 gap-x-10 gap-y-5">
              <Facts
                title="This settlement"
                rows={[
                  ['Reference', settlement.reference],
                  [
                    'Period',
                    `${formatDate(settlement.periodFrom)} – ${formatDate(settlement.periodTo)}`,
                  ],
                  ['Settled', formatDate(settlement.settledAt)],
                  ['Transfer reference', settlement.transferReference ?? '—'],
                  // Listed as a fact rather than a loose paragraph, which is
                  // where the PDF puts it too — an unlabelled sentence under
                  // the totals reads as a caption for them.
                  ...(settlement.notes ? [['Notes', settlement.notes] as [string, string]] : []),
                ]}
              />
              <Facts
                title="Paid into"
                rows={[
                  ['Account name', settlement.accountName],
                  [
                    settlement.accountKind === 'bank' ? 'Bank' : 'Mobile money',
                    settlement.destination || '—',
                  ],
                ]}
              />
            </section>

            <section className="rounded-card bg-surface-warm p-5">
              <Total label="Given by supporters" value={formatKwacha(settlement.grossMinor)} />
              <Total label="Platform commission" value={formatKwacha(settlement.commissionMinor)} muted />
              <div className="mt-3 flex items-baseline justify-between border-t border-line-strong pt-3">
                <span className="font-display text-[17px] text-ink">{netLabel}</span>
                <span className="font-display text-[19px] tabular-nums text-ink">
                  {formatKwacha(settlement.netMinor)}
                </span>
              </div>
            </section>

            <section>
              <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">
                {formatCount(settlement.paymentCount)} payment
                {settlement.paymentCount === 1 ? '' : 's'} in this settlement
              </div>
              {payments === null ? (
                <div className="h-24 animate-pulse rounded-card bg-surface-tint" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="pb-2 font-normal">Cleared</th>
                      <th className="pb-2 font-normal">Reference</th>
                      <th className="pb-2 font-normal">Network</th>
                      <th className="pb-2 text-right font-normal">Given</th>
                      <th className="pb-2 text-right font-normal">Commission</th>
                      <th className="pb-2 text-right font-normal">{netLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((row) => (
                      <tr key={row.id} className="border-b border-line-soft last:border-0">
                        <td className="py-2.5 whitespace-nowrap">
                          {row.completedAt ? formatDate(row.completedAt) : '—'}
                        </td>
                        <td className="text-muted">{row.reference}</td>
                        <td>{row.operator ? networkName(row.operator) : row.provider}</td>
                        <td className="text-right tabular-nums">{formatKwacha(row.amountMinor)}</td>
                        <td className="text-right tabular-nums text-muted">
                          {formatKwacha(row.commissionMinor)}
                        </td>
                        <td className="text-right tabular-nums">{formatKwacha(row.netMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <p className="text-xs leading-relaxed text-muted">
              Supporters gave the amounts above in full. The platform retains 20% to cover the
              payment rails, hosting and operations, and settles the remainder to the creator.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Facts({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">{title}</div>
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-6">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-right text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Total({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-sm text-body">{label}</span>
      <span className={`text-sm tabular-nums ${muted ? 'text-muted' : 'text-ink'}`}>{value}</span>
    </div>
  )
}
