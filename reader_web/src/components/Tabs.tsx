/**
 * A segmented control, in the reader's own chip vocabulary.
 *
 * The studio has its own `Tabs`; this is not that one. The two apps share the
 * design tokens and the query layer and nothing else, and a control that has to
 * look right in both ends up looking right in neither.
 */
export function Tabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T
  items: readonly { label: T; badge?: number }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-2">
      {items.map((item) => {
        const active = item.label === value
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.label)}
            className={`flex items-center gap-2 rounded-full border px-[14px] py-[7px] text-[13px] transition-colors ${
              active
                ? 'border-ink bg-ink text-surface-warm'
                : 'border-line-card text-body hover:border-line-strong'
            }`}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className={active ? 'text-surface-warm/70' : 'text-muted'}>{item.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
