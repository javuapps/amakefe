import { useState } from 'react'
import { formatCount, formatDate, formatKwacha, type Settlement } from '@amakefe/core'
import { SettlementStatement } from '@amakefe/ui'
import { Async, Panel, Stat } from '../components/shell'
import {
  useAccount,
  useDownloadStatement,
  useSettle,
  useSettlementPayments,
  useSettlements,
  useTotals,
} from '../hooks/queries'

/**
 * Paying the creator what she is owed.
 *
 * The transfer itself happens in a banking app; this records that it happened
 * and marks what it covered, in one statement, so a settlement cannot bank half
 * its payments and leave the rest owed forever.
 *
 * The idempotency key is minted when the form opens rather than when it is
 * submitted, so a double click or a retried request returns the settlement
 * already created instead of recording a second payout for one transfer.
 */
export function SettlementsScreen() {
  const totals = useTotals()
  const settlements = useSettlements()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<Settlement | null>(null)

  const canSettle = (totals.data?.awaitingCount ?? 0) > 0 && Boolean(account.data)

  return (
    <div className="flex flex-col gap-6">
      <Async query={totals}>
        {(data) => (
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="Awaiting settlement"
              value={formatKwacha(data.awaitingMinor)}
              note={`${formatCount(data.awaitingCount)} payment${data.awaitingCount === 1 ? '' : 's'}`}
            />
            <Stat label="Settled to date" value={formatKwacha(data.settledMinor)} />
            <Stat label="Commission kept" value={formatKwacha(data.commissionMinor)} />
          </div>
        )}
      </Async>

      <Panel
        title="Record a payout"
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!canSettle}
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
          >
            Settle what is owed
          </button>
        }
      >
        {/* An action that cannot be taken stays visible and says why. */}
        <p className="text-sm text-body">
          {!account.data
            ? 'No payout account is recorded. Add one before settling — a settlement names the account it actually paid.'
            : (totals.data?.awaitingCount ?? 0) === 0
              ? 'Nothing is awaiting settlement. Every successful payment is owed from the moment it clears.'
              : `Make the transfer first, then record it here. It will cover all ${formatCount(totals.data?.awaitingCount ?? 0)} payments currently owed — ${formatKwacha(totals.data?.awaitingMinor ?? 0)} to ${account.data.accountName}.`}
        </p>
      </Panel>

      <Panel title="Settlement history">
        <Async query={settlements}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-sm text-body">Nothing has been settled yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <SettlementRow key={row.id} settlement={row} onOpen={() => setViewing(row)} />
                ))}
              </div>
            )
          }
        </Async>
      </Panel>

      {viewing && <Statement settlement={viewing} onClose={() => setViewing(null)} />}

      {open && account.data && totals.data && (
        <SettleDialog
          accountId={account.data.id}
          accountName={account.data.accountName}
          amountMinor={totals.data.awaitingMinor}
          count={totals.data.awaitingCount}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function SettleDialog({
  accountId,
  accountName,
  amountMinor,
  count,
  onClose,
}: {
  accountId: string
  accountName: string
  amountMinor: number
  count: number
  onClose: () => void
}) {
  // Minted once, when the dialog opens. Submitting twice must not pay twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [transferReference, setTransferReference] = useState('')
  const [notes, setNotes] = useState('')
  const settleIt = useSettle()

  const field =
    'w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Record a payout"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !settleIt.isPending && onClose()
      }
    >
      <div className="w-full max-w-md rounded-card bg-surface p-6">
        <h2 className="font-display text-[21px] text-ink">Record a payout</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          {formatKwacha(amountMinor)} to {accountName}, covering {formatCount(count)} payment
          {count === 1 ? '' : 's'}. Record this only once the transfer has actually been made.
        </p>

        <label className="mt-5 block text-xs text-muted" htmlFor="transfer-reference">
          Transfer reference from the bank or wallet
        </label>
        <input
          id="transfer-reference"
          autoFocus
          value={transferReference}
          onChange={(event) => setTransferReference(event.target.value)}
          className={`${field} mt-1`}
        />

        <label className="mt-4 block text-xs text-muted" htmlFor="settlement-notes">
          Notes
        </label>
        <textarea
          id="settlement-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={`${field} mt-1 auto-grow`}
        />

        {settleIt.isError && (
          <p className="mt-3 text-xs text-accent-deep">
            {settleIt.error instanceof Error ? settleIt.error.message : 'That did not record.'}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={settleIt.isPending}
            className="rounded-full px-4 py-2 text-sm text-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              settleIt.mutate(
                { idempotencyKey, accountId, transferReference, notes },
                { onSuccess: onClose },
              )
            }
            disabled={settleIt.isPending}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface-warm disabled:opacity-40"
          >
            {settleIt.isPending ? 'Recording…' : `Record ${formatKwacha(amountMinor)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** One payout in the history. Clicking it opens the statement. */
function SettlementRow({ settlement, onOpen }: { settlement: Settlement; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-card border border-line-card p-4 text-left transition-colors hover:border-line-strong"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">
          {formatKwacha(settlement.netMinor)} to {settlement.accountName}
        </span>
        <span className="block text-xs text-muted">
          {formatDate(settlement.settledAt)} · {formatCount(settlement.paymentCount)} payment
          {settlement.paymentCount === 1 ? '' : 's'} · {settlement.destination}
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
 * The statement itself, which is `@amakefe/ui`'s and not this app's.
 *
 * The creator opens the identical component from her Supporters screen. Only
 * the word for the last column differs, and only because "settled" is what the
 * operators did and "yours" is what she received.
 */
function Statement({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  const payments = useSettlementPayments(settlement.id)
  const download = useDownloadStatement()

  return (
    <SettlementStatement
      settlement={settlement}
      payments={payments.data ?? null}
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
