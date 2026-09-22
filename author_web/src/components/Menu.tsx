import { useEffect, useRef, useState } from 'react'

/**
 * A short list of things you can do to one row.
 *
 * Not a `<select>`: these are actions, not a value, and a native select cannot
 * disable an option with a reason attached or colour a destructive one. It is a
 * menu, so it closes on Escape, on a click outside, and on choosing something.
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
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-56 overflow-hidden rounded-card border border-line-card bg-surface py-1 shadow-xl"
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
              className={`block w-full px-4 py-2 text-left text-[13px] transition-colors ${
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
      )}
    </div>
  )
}
