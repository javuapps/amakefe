import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { partState, type StudioPartSummary, type StudioStorySummary } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { formatWhen, sameDay } from '../components/DateTimeField'
import { useStorySummaries } from '../hooks/queries'

/**
 * What goes out, and when.
 *
 * Scheduling a part is giving it a publish time in the future: the RLS policy on
 * `cnt_story_parts` compares `published_at` to `now()`, so a part with a later
 * time is simply invisible until it arrives. Nothing has to run at the appointed
 * minute for the story to appear — only its Facebook post needs sending, and
 * that is the one job `cnt_send_due_facebook_posts()` does.
 *
 * This screen shows the week and what is queued. The publishing itself happens
 * in the studio, where the Facebook post is decided alongside it.
 */
export function ScheduleScreen() {
  const stories = useStorySummaries()
  const [weekOffset, setWeekOffset] = useState(0)
  const days = weekFrom(weekOffset)

  return (
    <Async query={stories}>
      {(list) => {
        const parts = list.flatMap((story) => story.parts.map((part) => ({ story, part })))
        const waiting = parts.filter(
          ({ part }) => part.publishedAt === null && part.wordCount > 0,
        )
        const empty = parts.filter(({ part }) => part.publishedAt === null && part.wordCount === 0)
        const scheduled = parts
          .filter(({ part }) => partState(part) === 'scheduled')
          .sort((a, b) => a.part.publishedAt!.getTime() - b.part.publishedAt!.getTime())

        return (
          <div className="flex flex-col gap-6">
            <Panel
              title={`Week of ${days[0]!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`}
              actions={
                <div className="flex gap-2">
                  <WeekButton label="← Previous" onClick={() => setWeekOffset((w) => w - 1)} />
                  <WeekButton label="This week" onClick={() => setWeekOffset(0)} />
                  <WeekButton label="Next →" onClick={() => setWeekOffset((w) => w + 1)} />
                </div>
              }
            >
              {/*
                * Seven columns is a week on a desk. On a phone it gives each
                * day 46px, which truncated every chip to "Par 1 T.. 22:" — a
                * calendar that cannot say what is on it. The same cells stack
                * into a day-by-day list below `lg`, each day a row with its
                * entries beside the date, so nothing has to be rendered twice.
                */}
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-7">
                {days.map((day) => {
                  const onDay = parts.filter(
                    ({ part }) => part.publishedAt && sameDay(part.publishedAt, day),
                  )
                  const isToday = sameDay(day, new Date())
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex gap-3 rounded-lg border p-2 lg:min-h-28 lg:flex-col lg:gap-0 ${
                        isToday ? 'border-accent bg-accent-wash/40' : 'border-line-soft bg-surface'
                      }`}
                    >
                      <div className="w-16 shrink-0 text-[11px] text-muted lg:w-auto">
                        {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 lg:mt-2 lg:flex-none">
                        {onDay.map(({ story, part }) => (
                          <DayEntry key={part.id} story={story} part={part} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            {scheduled.length > 0 && (
              <Panel title="Queued to go out">
                <div className="flex flex-col">
                  {scheduled.map(({ story, part }) => (
                    <ScheduledRow key={part.id} story={story} part={part} />
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Waiting to be scheduled">
              {waiting.length === 0 ? (
                <p className="text-sm text-muted">Every written part has a publish time.</p>
              ) : (
                <div className="flex flex-col">
                  {waiting.map(({ story, part }) => (
                    <WaitingRow key={part.id} story={story} part={part} />
                  ))}
                </div>
              )}

              {/* Listed but not schedulable: the database refuses an empty part
                  a publish time, so offering the field here would be a lie. */}
              {empty.length > 0 && (
                <div className="mt-5 border-t border-line-soft pt-4">
                  <p className="text-xs text-muted">Nothing written in these yet:</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {empty.map(({ story, part }) => (
                      <li key={part.id} className="text-[13px]">
                        <Link
                          to={`/stories/${story.id}/parts/${part.id}`}
                          className="text-body hover:text-accent-deep"
                        >
                          <span className="font-semibold">Part {part.partNumber}</span> ·{' '}
                          {story.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <p className="text-xs text-muted">
              Multi-channel publishing — push, email digest, an automatic Facebook post — is spec
              §42 and is not built. A scheduled part appears in the app at its publish time and
              nowhere else.
            </p>
          </div>
        )
      }}
    </Async>
  )
}

function WeekButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line-card px-3 py-1 text-xs text-body hover:border-line-strong"
    >
      {label}
    </button>
  )
}

function DayEntry({ story, part }: { story: StudioStorySummary; part: StudioPartSummary }) {
  const live = partState(part) === 'live'
  return (
    <Link
      to={`/stories/${story.id}/parts/${part.id}`}
      // One line on a phone with the title taking what is left; three stacked
      // lines in a 46px-wide column on a desk, where there is no room for a
      // line and the day already says the date.
      className={`flex min-w-0 items-baseline gap-x-2 rounded p-1.5 text-[11px] leading-tight transition-opacity hover:opacity-80 lg:block ${
        live ? 'bg-ink text-surface-warm' : 'border border-gold bg-surface-warm text-body'
      }`}
    >
      <span className="shrink-0 font-semibold">Part {part.partNumber}</span>
      <span className="min-w-0 flex-1 truncate opacity-80 lg:block lg:flex-none">
        {story.title}
      </span>
      <span className="shrink-0 opacity-70 lg:block">
        {part.publishedAt!.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        {!live && ' · queued'}
      </span>
    </Link>
  )
}

function ScheduledRow({ story, part }: { story: StudioStorySummary; part: StudioPartSummary }) {
  return (
    <Row story={story} part={part}>
      <span className="text-xs text-gold">Goes out {formatWhen(part.publishedAt!)}</span>
    </Row>
  )
}

function WaitingRow({ story, part }: { story: StudioStorySummary; part: StudioPartSummary }) {
  return (
    <Row story={story} part={part}>
      <span className="text-xs text-muted">
        {part.wordCount.toLocaleString('en-GB')} words written
      </span>
    </Row>
  )
}

/**
 * A row here is a link, not a control.
 *
 * Publishing and scheduling live in the part studio alone, because a part now
 * carries a Facebook post with it and that is decided while writing — a
 * date-picker on this screen would be a second way to publish that quietly
 * skipped the post.
 */
function Row({
  story,
  part,
  children,
}: {
  story: StudioStorySummary
  part: StudioPartSummary
  children: ReactNode
}) {
  return (
    <Link
      to={`/stories/${story.id}/parts/${part.id}`}
      className="group flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3 first:border-0 first:pt-0"
    >
      <div className="min-w-0">
        <div className="text-[13px] text-ink group-hover:text-accent-deep">
          <span className="font-semibold">Part {part.partNumber}</span> · {story.title}
        </div>
        {children}
      </div>
      <span className="shrink-0 text-xs text-muted group-hover:text-accent">Open →</span>
    </Link>
  )
}

function weekFrom(offset: number): Date[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay() + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}
