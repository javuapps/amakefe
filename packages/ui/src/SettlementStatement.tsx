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
      className="modal-scrim fixed inset-0 z-50 flex justify-center bg-ink/50"
      role="dialog"
      aria-modal="true"
      aria-label={`Settlement ${settlement.reference}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel flex h-full w-full flex-col bg-surface">
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
            <section className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
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
                <div>
                  <div className="hidden border-b border-line pb-2 text-xs text-muted lg:grid lg:grid-cols-[minmax(0,1fr)_repeat(3,96px)] lg:gap-3">
                    <span>Cleared · reference · network</span>
                    <span className="text-right">Given</span>
                    <span className="text-right">Commission</span>
                    <span className="text-right">{netLabel}</span>
                  </div>
                  <ul>
                    {payments.map((row) => (
                      <li
                        key={row.id}
                        className="grid gap-x-3 gap-y-1 border-b border-line-soft py-3 last:border-0 lg:grid-cols-[minmax(0,1fr)_repeat(3,96px)] lg:items-baseline"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-ink">
                            {row.completedAt ? formatDate(row.completedAt) : '—'} ·{' '}
                            {row.operator ? networkName(row.operator) : row.provider}
                          </div>
                          <div className="truncate text-xs text-muted">{row.reference}</div>
                        </div>
                        {/* Three labelled figures wrapping under the payment on
                            a phone; three columns on a desk, where the header
                            above names them. */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 lg:contents">
                          <Figure label="Given" value={formatKwacha(row.amountMinor)} />
                          <Figure
                            label="Commission"
                            value={formatKwacha(row.commissionMinor)}
                            muted
                          />
                          <Figure label={netLabel} value={formatKwacha(row.netMinor)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
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

/**
 * One figure from a payment. Its label shows on a phone, where nothing else
 * says what the number is, and is hidden from `lg`, where the column header
 * does — the same arrangement as the dashboard's performance list.
 */
function Figure({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <span className="text-sm lg:text-right">
      <span className="text-xs text-muted lg:hidden">{label} </span>
      <span className={`tabular-nums ${muted ? 'text-muted' : 'text-ink'}`}>{value}</span>
    </span>
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
