import type { ReactNode } from 'react'

/**
 * The studio's pill tab bar.
 *
 * `fill` spreads the tabs across the whole width, which is what the inspector's
 * narrow column wants; left alone the bar is only as wide as its labels, which
 * is what a wide column wants.
 */
export type Tab = { label: string; badge?: ReactNode }

export function Tabs({
  items,
  value,
  onChange,
  fill = false,
}: {
  items: Tab[]
  value: string
  onChange: (label: string) => void
  fill?: boolean
}) {
  return (
    <div
      role="tablist"
      className={`items-center gap-1 rounded-full border border-line-card bg-surface p-1 ${
        fill ? 'flex' : 'inline-flex self-start'
      }`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="tab"
          aria-selected={value === item.label}
          onClick={() => onChange(item.label)}
          className={`rounded-full py-1.5 text-xs transition-colors ${fill ? 'flex-1 px-2' : 'px-4'} ${
            value === item.label ? 'bg-ink text-surface-warm' : 'text-body hover:bg-surface-warm'
          }`}
        >
          {item.label}
          {item.badge != null && <span className="ml-1.5">{item.badge}</span>}
        </button>
      ))}
    </div>
  )
}
