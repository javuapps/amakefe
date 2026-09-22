import { useEffect, useRef, useState } from 'react'

/**
 * Picking a day and a time.
 *
 * `<input type="datetime-local">` was here, and it brings the operating
 * system's own widget: Chrome's grey calendar on Linux, something else on a
 * Mac, and on none of them the typeface or the palette of the rest of the
 * studio. It also says `mm/dd/yyyy` regardless of where you are. This is the
 * same shape as the confirm dialog and the options menu — the product's, not
 * the platform's.
 *
 * Times are shown and returned in the browser's own zone, which is the one the
 * creator is thinking in when she says "Tuesday morning".
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = [0, 15, 30, 45]

export function DateTimeField({
  value,
  onChange,
  placeholder = 'Pick a time',
}: {
  value: Date | null
  onChange: (value: Date) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()))
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

  // A day on its own is not a time, so picking one lands on 09:00 — early
  // enough to be a morning post, and changeable in the column beside it.
  const pickDay = (day: Date) => {
    const next = new Date(day)
    next.setHours(value?.getHours() ?? 9, value?.getMinutes() ?? 0, 0, 0)
    onChange(next)
  }

  const pickTime = (hours: number, minutes: number) => {
    const next = new Date(value ?? new Date())
    next.setHours(hours, minutes, 0, 0)
    onChange(next)
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`w-[200px] rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
          open ? 'border-accent' : 'border-line-card hover:border-line-strong'
        } ${value ? 'text-ink' : 'text-muted'}`}
      >
        {value ? formatWhen(value) : placeholder}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick a day and time"
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex gap-4 rounded-card border border-line-card bg-surface p-4 shadow-xl"
        >
          <div className="w-[236px]">
            <div className="flex items-center justify-between">
              <MonthButton label="←" onClick={() => setMonth(addMonths(month, -1))} />
              <span className="text-[13px] font-semibold text-ink">
                {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </span>
              <MonthButton label="→" onClick={() => setMonth(addMonths(month, 1))} />
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-label text-muted">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day.charAt(0)}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthGrid(month).map((day) => {
                const outside = day.getMonth() !== month.getMonth()
                const past = isBeforeToday(day)
                const chosen = value != null && sameDay(day, value)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={past}
                    onClick={() => pickDay(day)}
                    className={`aspect-square rounded-lg text-xs transition-colors ${
                      chosen
                        ? 'bg-ink font-semibold text-surface-warm'
                        : past
                          ? 'text-line-strong'
                          : outside
                            ? 'text-muted hover:bg-surface-warm'
                            : 'text-ink hover:bg-surface-warm'
                    } ${sameDay(day, new Date()) && !chosen ? 'ring-1 ring-accent' : ''}`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 border-l border-line-soft pl-4">
            <TimeColumn
              label="Hour"
              values={HOURS}
              selected={value?.getHours()}
              format={(hour) => String(hour).padStart(2, '0')}
              onPick={(hour) => pickTime(hour, value?.getMinutes() ?? 0)}
            />
            <TimeColumn
              label="Min"
              values={MINUTES}
              selected={value ? nearestStep(value.getMinutes()) : undefined}
              format={(minute) => String(minute).padStart(2, '0')}
              onPick={(minute) => pickTime(value?.getHours() ?? 9, minute)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MonthButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === '←' ? 'Previous month' : 'Next month'}
      className="rounded-full px-2 py-1 text-xs text-muted hover:bg-surface-warm hover:text-ink"
    >
      {label}
    </button>
  )
}

function TimeColumn({
  label,
  values,
  selected,
  format,
  onPick,
}: {
  label: string
  values: number[]
  selected: number | undefined
  format: (value: number) => string
  onPick: (value: number) => void
}) {
  return (
    <div className="flex flex-col">
      <span className="pb-1 text-center text-[10px] uppercase tracking-label text-muted">
        {label}
      </span>
      {/* Its own scroll region, which is the one place in the studio that earns
          a second one: twenty-four hours will not fit beside a month. */}
      <div className="phone-screen h-[196px] w-[46px] rounded-lg border border-line-soft">
        {values.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => onPick(entry)}
            className={`block w-full py-1.5 text-center text-xs transition-colors ${
              entry === selected
                ? 'bg-ink font-semibold text-surface-warm'
                : 'text-body hover:bg-surface-warm'
            }`}
          >
            {format(entry)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Tue 23 September, 09:00" — the day named, because a date alone invites a mis-read. */
export function formatWhen(value: Date): string {
  return `${value.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })}, ${value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1)

const addMonths = (value: Date, delta: number) =>
  new Date(value.getFullYear(), value.getMonth() + delta, 1)

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function isBeforeToday(day: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return day < today
}

const nearestStep = (minutes: number) =>
  MINUTES.reduce((best, step) =>
    Math.abs(step - minutes) < Math.abs(best - minutes) ? step : best,
  )

/** Six Sunday-first weeks, so the grid never changes height between months. */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}
