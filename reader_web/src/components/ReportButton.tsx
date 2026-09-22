import { useState } from 'react'
import { reportComment, type CommentKind } from '@amakefe/core'
import { db } from '../db'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

/**
 * The one thing a reader can do about someone else's words.
 *
 * `mod_reports` has had an insert policy since the first schema and nothing
 * ever called it, so the studio's queue only ever showed what a moderator
 * happened to scroll past — never what a reader objected to.
 *
 * It asks for a reason before sending. A report with no reason is a downvote,
 * and a moderator reading a queue of them learns nothing about why any of it
 * is there. The reasons are the ones people actually mean; "Something else"
 * carries the free text.
 *
 * Reporting twice is not two reports — a unique constraint says so — and the
 * query treats that as already done rather than as a failure, because the
 * reader's intent was satisfied either way. That is also why the button says
 * "Reported" afterwards and stops: a second press should not feel like the
 * first one failed.
 */
const REASONS = [
  'It is abusive or hateful',
  'It shares private details',
  'It is spam',
  'Something else',
] as const

export function ReportButton({ kind, commentId }: { kind: CommentKind; commentId: string }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [other, setOther] = useState('')
  const signIn = useSignInPrompt()

  const send = async (reason: string) => {
    setBusy(true)
    try {
      await reportComment(db, kind, commentId, reason)
      setSent(true)
      setOpen(false)
    } catch (error) {
      signIn.onError(error, 'Report this comment?', () => void send(reason))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return <span className="text-xs text-muted">Reported · thank you</span>
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted">
        Report
      </button>

      {open && (
        <div
          className="modal-scrim fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Report this comment"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}
        >
          <div className="modal-panel w-full rounded-t-card bg-surface p-5 sm:max-w-sm sm:rounded-card">
            <h2 className="font-display text-[19px] text-ink">Report this comment</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-body">
              A moderator reads every report. The person who wrote it is not told who reported it.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {REASONS.slice(0, -1).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(reason)}
                  className="rounded-tile border border-line-card px-3 py-2.5 text-left text-sm text-ink disabled:opacity-40"
                >
                  {reason}
                </button>
              ))}
              <textarea
                value={other}
                onChange={(event) => setOther(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Something else — tell them what"
                className="auto-grow rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-accent"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-xs text-muted disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                // The free-text box needs three characters, which is what the
                // database's own check on `reason` asks for.
                disabled={busy || other.trim().length < 3}
                onClick={() => void send(other)}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface-warm disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {signIn.node}
    </>
  )
}
