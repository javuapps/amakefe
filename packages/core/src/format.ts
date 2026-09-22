const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "18 September 2026" — the way the design writes dates. */
export const formatDate = (date: Date): string => dayMonthYear.format(date)

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** "2 hours ago", "last week" — used for creator posts and answered questions. */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const magnitude = Math.abs(seconds)

  for (const [unit, unitSeconds] of UNITS) {
    if (magnitude >= unitSeconds) {
      return relative.format(Math.round(seconds / unitSeconds), unit)
    }
  }
  return 'just now'
}

/** Thousands separators, as the like counter in the prototype shows them. */
export const formatCount = (value: number): string => value.toLocaleString('en-GB')
