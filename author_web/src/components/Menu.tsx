import { useEffect, useRef, useState } from 'react'

/**
 * A short list of things you can do to one row.
 *
 * Not a `<select>`: these are actions, not a value, and a native select cannot
 * disable an option with a reason attached or colour a destructive one. It is a
 * menu, so it closes on Escape, on a click outside, and on choosing something.
 *
 * **A dropdown on a desk, an action sheet in a hand.** Anchored to its trigger
 * it was `right-0 w-56`, which is right when the trigger is near the right edge
 * — a part row — and wrong when it is near the left — the part page's toolbar,
 * where 224px of menu hung 37px off the side of a 402px screen. No fixed side
 * serves both, and the alternative is measuring the trigger on every open. From
 * `sm` it stays the dropdown it was; below that it is pinned to the bottom of
 * the viewport, where its position does not depend on the trigger at all and
 * the targets can be finger-sized.
 *
 * The sheet is `fixed`, so it must not be rendered inside anything carrying a
 * transform — that would make the transform its containing block. None of the
 * three call sites is inside `.modal-panel`; a fourth one in the part studio
 * would need checking.
 *
 * It rises (`.modal-panel`) at both sizes rather than using `.sheet-panel`,
 * which turns into the drawer's slide from `lg`. A dropdown pinned to its
 * trigger has not come from the right edge and should not pretend to. That is
 * also the cheaper answer: `.sheet-panel` sets `animation` inside a media
 * query, so a `sm:animate-none` utility does not reliably beat it — which of
 * the two wins depends on the order of the stylesheet, not the markup.
 */
export type MenuItem = {
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Why it cannot be done, or what it will do. Shown under the label. */
  hint?: string
  tone?: 'default' | 'danger'
}

export function Menu({ items, label = 'Options' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          // The row underneath is a link; opening its menu is not following it.
          event.preventDefault()
          event.stopPropagation()
          setOpen((was) => !was)
        }}
        className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-1.5 text-xs text-body hover:border-accent"
      >
        {label}
        <span aria-hidden className="text-[9px]">
          ▼
        </span>
      </button>

      {open && (
        <>
          {/* Only below `sm`, where the menu has left its trigger: it says the
              rest of the page is not the thing to tap, and it is what closes
              the sheet on a tap outside — the outside-click handler above sees
              a click in here as inside, because it is. */}
          <div
            aria-hidden
            onMouseDown={() => setOpen(false)}
            className="modal-scrim fixed inset-0 z-40 bg-ink/40 sm:hidden"
          />
          <div
            role="menu"
            className="modal-panel fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-card border border-line-card bg-surface py-1 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+6px)] sm:z-20 sm:w-56"
          >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
              className={`block w-full px-4 py-3 text-left text-[13px] transition-colors sm:py-2 ${
                item.disabled
                  ? 'cursor-not-allowed text-muted opacity-60'
                  : item.tone === 'danger'
                    ? 'text-accent-deep hover:bg-accent-wash'
                    : 'text-ink hover:bg-surface-warm'
              }`}
            >
              {item.label}
              {item.hint && <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>}
            </button>
          ))}
          </div>
        </>
      )}
    </div>
  )
}
