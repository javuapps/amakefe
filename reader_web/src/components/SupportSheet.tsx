import { useEffect, useState } from 'react'
import type { Enums } from '@amakefe/core'
import {
  OPERATORS,
  formatKwacha,
  localPhone,
  networkName,
  operatorForPhone,
  walletProblem,
  type Operator,
} from '@amakefe/core'
import { useCollectionStatus, useStartCollection } from '../hooks/queries'

/**
 * Taking a mobile money payment.
 *
 * The prototype's Support screen stops at the button — it shows no payment
 * flow at all — so this is a stated deviation, built in the product's own
 * vocabulary rather than a provider's checkout page. It is the same right-hand
 * drawer as the sign-in sheet, because it is the same kind of interruption.
 *
 * Three states, and nothing navigates: ask, wait, and the answer. Mobile money
 * is a conversation with a phone in someone's hand, so waiting is a state the
 * screen has to be able to sit in — not a spinner over the whole app.
 */
export function SupportSheet({
  amountMinor,
  onClose,
}: {
  amountMinor: number
  onClose: () => void
}) {
  const [operator, setOperator] = useState<Operator | null>(null)
  const [phone, setPhone] = useState('')
  const [reference, setReference] = useState<string | null>(null)

  const start = useStartCollection()
  const collection = useCollectionStatus(reference)
  const status = collection.data?.status ?? (reference ? 'pending' : null)

  // Closable at every step, including while the prompt is out — the waiting
  // state says so, and a sheet that says "you can close this" and then refuses
  // Escape is worse than one that never offered. The only moment it holds is
  // the second between pressing send and having a reference, where closing
  // would orphan a payment nobody could follow.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) =>
      event.key === 'Escape' && !start.isPending && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [start.isPending, onClose])

  // The prefix says which network it is, so choosing one by hand is a
  // correction rather than a step. Typed over a choice, the number wins.
  useEffect(() => {
    const detected = operatorForPhone(phone)
    if (detected) setOperator(detected)
  }, [phone])

  const problem = operator && phone.length >= 9 ? walletProblem(operator, phone) : null
  const ready = Boolean(operator) && !problem && phone.replace(/\D/g, '').length >= 9

  const submit = () => {
    if (!operator || !ready) return
    start.mutate(
      { amountMinor, operator, phone: localPhone(phone) },
      { onSuccess: setReference },
    )
  }

  return (
    <div
      className="drawer-scrim fixed inset-0 z-50 flex justify-end bg-ink/60"
      role="dialog"
      aria-modal="true"
      aria-label="Support the community"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !start.isPending && onClose()
      }
    >
      <div className="drawer-panel flex h-full w-full max-w-[420px] flex-col overflow-y-auto bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[22px] leading-snug text-ink">{heading(status, amountMinor)}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={start.isPending}
            className="shrink-0 text-xs text-muted disabled:opacity-40"
          >
            {dismissLabel(status)}
          </button>
        </div>

        {status === null && (
          <Ask
            amountMinor={amountMinor}
            operator={operator}
            onOperator={setOperator}
            phone={phone}
            onPhone={setPhone}
            problem={problem}
            ready={ready}
            busy={start.isPending}
            error={start.error instanceof Error ? start.error.message : null}
            onSubmit={submit}
          />
        )}

        {status === 'pending' && reference && (
          <Waiting
            operator={operator}
            amountMinor={amountMinor}
            phone={localPhone(phone)}
            reference={reference}
          />
        )}

        {status === 'successful' && (
          <p className="mt-3 text-[14px] leading-relaxed text-body">
            {formatKwacha(collection.data?.amountMinor ?? amountMinor)} received. That pays for the
            phone calls, the data and the editing, and it keeps every story free to read.
          </p>
        )}

        {status !== null && status !== 'pending' && status !== 'successful' && (
          <Refused
            status={status}
            onAgain={() => {
              setReference(null)
              start.reset()
            }}
          />
        )}
      </div>
    </div>
  )
}

/** "Not now" is a refusal; once money is moving it is a dismissal. */
function dismissLabel(status: Enums<'sup_status'> | null): string {
  if (status === null) return 'Not now'
  return status === 'successful' ? 'Done' : 'Close'
}

/** The sheet names the state it is in, so the answer is not buried in the body. */
function heading(status: Enums<'sup_status'> | null, amountMinor: number): string {
  switch (status) {
    case null:
      return `Give ${formatKwacha(amountMinor)}`
    case 'pending':
      return 'Check your phone'
    case 'successful':
      return 'Thank you'
    default:
      return 'Not taken'
  }
}

const field =
  'w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-3 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-accent'

function Ask({
  amountMinor,
  operator,
  onOperator,
  phone,
  onPhone,
  problem,
  ready,
  busy,
  error,
  onSubmit,
}: {
  amountMinor: number
  operator: Operator | null
  onOperator: (operator: Operator) => void
  phone: string
  onPhone: (phone: string) => void
  problem: string | null
  ready: boolean
  busy: boolean
  error: string | null
  onSubmit: () => void
}) {
  return (
    <>
      <p className="mt-3 text-[14px] leading-relaxed text-body">
        We will send a prompt to your phone. Approve it with your mobile money PIN and nothing
        leaves your wallet until you do.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {OPERATORS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onOperator(value)}
            className={`rounded-tile border-[1.5px] px-2 py-3 text-[12.5px] font-semibold transition-colors ${
              operator === value
                ? 'border-accent bg-accent-wash text-accent'
                : 'border-line-card text-ink'
            }`}
          >
            {networkName(value)}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs text-muted" htmlFor="support-phone">
        Mobile money number
      </label>
      <input
        id="support-phone"
        autoFocus
        value={phone}
        onChange={(event) => onPhone(event.target.value.replace(/[^\d+ ]/g, ''))}
        onKeyDown={(event) => event.key === 'Enter' && ready && !busy && onSubmit()}
        inputMode="tel"
        autoComplete="tel"
        placeholder="0977 000 111"
        className={`${field} mt-1`}
      />

      {problem && <p className="mt-2 text-xs text-accent-deep">{problem}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!ready || busy}
        className="mt-4 w-full rounded-full bg-accent py-4 text-base font-bold text-[#fff6ea] disabled:opacity-40"
      >
        {busy ? 'Sending the prompt…' : `Send a prompt for ${formatKwacha(amountMinor)}`}
      </button>

      {error && <p className="mt-3 text-xs text-accent-deep">{error}</p>}

      <p className="mt-auto pt-6 text-xs leading-relaxed text-muted">
        Your number is used for this payment and is never shown to anyone. Supporting does not
        need an account.
      </p>
    </>
  )
}

/**
 * The gap between sending a prompt and hearing what became of it.
 *
 * Modelled on ginni's `PaymentWaiting`, including the thing it gets right that
 * is easy to get wrong: it says **closing this is safe**, because it is. The
 * webhook and the reconciler settle the payment whatever the browser does, and
 * someone who believes otherwise sits watching a screen — or, worse, decides it
 * has stalled and pays a second time.
 *
 * It is not quite ginni's promise, though. A supporter here need not have an
 * account, so closing the page loses the *confirmation* even though it cannot
 * lose the payment. The copy says exactly that rather than the comfortable
 * half of it.
 */
function Waiting({
  operator,
  amountMinor,
  phone,
  reference,
}: {
  operator: Operator | null
  amountMinor: number
  phone: string
  reference: string
}) {
  return (
    // Announced rather than just drawn: without this a screen reader sits in
    // silence through the one part of the flow that takes real time.
    <div className="flex flex-col items-center pt-10 text-center" role="status" aria-live="polite">
      <span
        className="spinner size-10 rounded-full border-[2.5px] border-line-strong border-t-accent"
        aria-hidden
      />

      <p className="mt-6 text-[14px] leading-relaxed text-body">
        {operator ? networkName(operator) : 'Your network'} has sent a prompt for{' '}
        <span className="text-ink">{formatKwacha(amountMinor)}</span> to{' '}
        <span className="text-ink">{phone}</span>. Enter your PIN to approve it.
      </p>

      <p className="mt-5 w-full rounded-card bg-surface-warm p-[18px] text-[13.5px] leading-relaxed text-body">
        You can close this. The payment goes through on its own once you approve it — closing only
        means you will not see it happen here.
      </p>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        If no prompt arrives, dial your network&rsquo;s mobile money menu and try again in a few
        minutes.
      </p>

      {/* Worth showing: it is the only handle a supporter with no account has
          on the payment if they ever need to ask about it. */}
      {/* text-muted, not text-subtle: at 12px anything paler than this stops
          being readable, which defeats the point of printing it. */}
      <p className="mt-5 text-xs text-muted">Reference {reference}</p>
    </div>
  )
}

function Refused({
  status,
  onAgain,
}: {
  status: Enums<'sup_status'>
  onAgain: () => void
}) {
  return (
    <>
      <p className="mt-3 text-[14px] leading-relaxed text-body">
        {status === 'failed'
          ? 'That payment did not go through. Nothing has left your wallet.'
          : `That payment came back ${status}. Nothing is owed.`}
      </p>
      <button
        type="button"
        onClick={onAgain}
        className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-semibold text-surface-warm"
      >
        Try again
      </button>
    </>
  )
}
