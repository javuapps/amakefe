import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

/**
 * Asking before something irreversible.
 *
 * `window.confirm` is the browser's dialog, not the product's: it arrives in the
 * operating system's colours and typeface, it says "localhost:5174 says", and it
 * blocks the whole page while it is open. Nothing in this app is allowed to look
 * like that, so every question goes through here instead.
 *
 * The API deliberately mirrors what it replaces — `await confirm(…)` returns a
 * boolean — so a call site reads the same way as the one-liner it displaces.
 */
export type ConfirmOptions = {
  title: string
  /** The consequence, in a sentence. Skip it when the title already says it. */
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` for anything that destroys or withdraws something. */
  tone?: 'default' | 'danger'
}

type Request = { options: ConfirmOptions; settle: (answer: boolean) => void }

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export const useConfirm = () => {
  const confirm = use(ConfirmContext)
  if (!confirm) throw new Error('useConfirm outside ConfirmProvider')
  return confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setRequest({
          options,
          settle: (answer) => {
            setRequest(null)
            resolve(answer)
          },
        })
      }),
    [],
  )

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request && <ConfirmDialog request={request} />}
    </ConfirmContext>
  )
}

function ConfirmDialog({ request }: { request: Request }) {
  const { title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' } =
    request.options
  const { settle } = request

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settle])

  return (
    // Above the full-screen studio and the new-story dialog, both of which can
    // be the thing asking.
    <div
      className="modal-scrim fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) settle(false)
      }}
    >
      <div className="modal-panel w-full max-w-sm rounded-card border border-line-card bg-surface p-5 shadow-xl">
        <h2 className="font-display text-[19px] leading-snug text-ink">{title}</h2>
        {body && <p className="mt-2 text-[13px] leading-relaxed text-body">{body}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={() => settle(false)} className="text-xs text-muted">
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => settle(true)}
            className={`rounded-full px-5 py-2 text-xs font-semibold ${
              tone === 'danger' ? 'bg-accent text-[#fff6ea]' : 'bg-ink text-surface-warm'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
