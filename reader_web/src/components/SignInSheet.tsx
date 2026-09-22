import { useEffect, useState } from 'react'
import { useAuth, type Intent } from '../auth'
import { FacebookButton } from './FacebookButton'

/**
 * The sign-in ask, at the moment it is needed.
 *
 * It carries the reason it opened — "Save this for later?" — because a sign-in
 * prompt with no cause reads as a toll gate. The reader can always dismiss it
 * and carry on reading; nothing behind it is locked.
 *
 * The gesture that triggered it is remembered and replayed after the round trip
 * to Facebook, so agreeing to sign in finishes the thing they were doing rather
 * than returning them to the start of it.
 */
export function SignInSheet({
  reason,
  intent,
  onClose,
}: {
  reason: string
  intent?: Intent
  onClose: () => void
}) {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <div
      className="drawer-scrim fixed inset-0 z-50 flex justify-end bg-ink/60"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div className="drawer-panel flex h-full w-full max-w-[420px] flex-col border-l border-line-card bg-surface p-6">
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

        <p className="mt-3 text-[14px] leading-relaxed text-body">
          Sign in so this stays with you — on this phone and the next one.
        </p>

        <div className="mt-6">
          <FacebookButton
            busy={busy}
            onClick={() => {
              setBusy(true)
              void signIn(intent)
            }}
          />
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Your name and picture appear beside anything you post here, as they would on the Page.
          Questions you send to Amake Fe are always published anonymously.
        </p>

        <p className="mt-auto pt-6 text-xs text-muted">Reading never needs an account.</p>
      </div>
    </div>
  )
}
