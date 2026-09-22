import { useCallback, useEffect, useState } from 'react'
import { sendEmailCode, verifyEmailCode } from '@amakefe/core'
import { db } from '../db'

/**
 * The sign-in ask, at the moment it is needed.
 *
 * It carries the reason it opened — "Save this for later?" — because a sign-in
 * prompt with no cause reads as a toll gate. The reader can always dismiss it
 * and carry on reading; nothing behind it is locked.
 *
 * Two steps, both in place. Nothing navigates away, so the story stays where it
 * was and `onSignedIn` finishes the gesture that opened this.
 */

/**
 * Supabase sends at most one code per address per minute, so the resend is held
 * shut for that long and says how long is left. Offering a button that only
 * returns a rate-limit error would be worse than offering nothing — the reader
 * would read it as the app failing rather than as the email being on its way.
 */
const RESEND_SECONDS = 60
export function SignInSheet({
  reason,
  onSignedIn,
  onClose,
}: {
  reason: string
  onSignedIn: () => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [resentAt, setResentAt] = useState<number | null>(null)
  const [wait, setWait] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // The countdown runs off a deadline rather than a tick count, so a phone that
  // sleeps mid-wait comes back with the right number instead of a frozen one.
  useEffect(() => {
    if (wait <= 0) return
    const timer = setInterval(() => setWait((left) => Math.max(0, left - 1)), 1000)
    return () => clearInterval(timer)
  }, [wait])

  const send = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await sendEmailCode(db, email)
      setSent(true)
      setWait(RESEND_SECONDS)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not send.')
    } finally {
      setBusy(false)
    }
  }, [email])

  const resend = async () => {
    setResending(true)
    setError(null)
    try {
      await sendEmailCode(db, email)
      // The old code may still work, but a fresh field stops the reader typing
      // digits from the first email into a prompt about the second.
      setCode('')
      setWait(RESEND_SECONDS)
      setResentAt(Date.now())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not send.')
    } finally {
      setResending(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifyEmailCode(db, email, code)
      // The session exists now, so the thing they were doing can go through.
      onSignedIn()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code did not work.')
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-3 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-accent'

  return (
    <div
      className="drawer-scrim fixed inset-0 z-50 flex justify-end bg-ink/60"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div className="drawer-panel flex h-full w-full max-w-[420px] flex-col bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[22px] leading-snug text-ink">{reason}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-xs text-muted disabled:opacity-40"
          >
            Not now
          </button>
        </div>

        {sent ? (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-body">
              We sent a six-digit code to <span className="text-ink">{email}</span>. Enter it below.
            </p>
            <input
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              // A numeric keypad on a phone, and the code filled in from the
              // notification where the browser offers it.
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={`${field} mt-4 text-center tracking-[0.4em]`}
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.length < 6}
              className="mt-3 w-full rounded-full bg-ink py-3 text-sm font-semibold text-surface-warm disabled:opacity-40"
            >
              {busy ? 'Checking…' : 'Confirm'}
            </button>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {wait > 0 ? (
                <span className="text-xs text-muted">
                  {resentAt ? 'Sent again. ' : ''}You can ask for another in {wait}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={resend}
                  disabled={resending || busy}
                  className="text-xs text-accent disabled:opacity-40"
                >
                  {resending ? 'Sending…' : 'Send another code'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSent(false)
                  setCode('')
                  setError(null)
                  setResentAt(null)
                  setWait(0)
                }}
                disabled={busy || resending}
                className="text-xs text-muted disabled:opacity-40"
              >
                Use a different address
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-body">
              Sign in so this stays with you — on this phone and the next one. We send a code; there
              is no password to remember.
            </p>
            <input
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && email.includes('@') && void send()}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={`${field} mt-4`}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !email.includes('@')}
              className="mt-3 w-full rounded-full bg-ink py-3 text-sm font-semibold text-surface-warm disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
          </>
        )}

        {error && <p className="mt-3 text-xs text-accent-deep">{error}</p>}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Your email address is never shown to anyone. You choose the name that appears beside
          anything you post, and questions you send to Amake Fe are always published anonymously.
        </p>

        <p className="mt-auto pt-6 text-xs text-muted">Reading never needs an account.</p>
      </div>
    </div>
  )
}
