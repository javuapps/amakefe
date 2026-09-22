import { useState } from 'react'
import { formatCount } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import {
  useDashboardStats,
  useSeriesRetention,
  useStoryPerformance,
  useStorySummaries,
} from '../hooks/queries'

export function DashboardScreen() {
  const stats = useDashboardStats()
  const performance = useStoryPerformance()

  return (
    <div className="flex flex-col gap-6">
      <Async query={stats} loading={<div className="h-24 animate-pulse rounded-card bg-surface-tint" />}>
        {(data) =>
          data && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Readers this week" value={formatCount(data.weeklyReaders)} />
              <Stat
                label="Stories started"
                value={formatCount(data.storiesStarted)}
                note={`${formatCount(data.storiesFinished)} finished`}
              />
              <Stat label="Saves" value={formatCount(data.saves)} note={`${formatCount(data.comments)} comments`} />
              <Stat
                label="Support this month"
                value={`ZMW ${formatCount(Math.round(data.monthlySupportMinor / 100))}`}
                note={`${formatCount(data.supporters)} supporters`}
              />
            </div>
          )
        }
      </Async>

      {stats.data?.storiesStarted === 0 && (
        <p className="rounded-card border border-line-card bg-surface-raised p-4 text-sm text-body">
          These are live counts from what readers actually do, not estimates — so they stay at zero
          until the reader app is in front of people.
        </p>
      )}

      <SeriesRetention />

      <Panel title="Story performance">
        <Async query={performance}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-sm text-muted">No published stories yet.</p>
            ) : (
              /*
               * Not a table.
               *
               * Six numeric columns beside a story title is a desk layout, and
               * at 402px it was either squashed or scrolling sideways with its
               * header sliced mid-word. One grid does both instead: the figures
               * wrap under the title on a phone, each carrying its own label,
               * and line up in columns from `lg`, where the header row above
               * supplies the labels and each figure hides its own.
               */
              <div>
                <div className="hidden border-b border-line pb-2 text-xs text-muted lg:grid lg:grid-cols-[minmax(0,1fr)_repeat(5,80px)] lg:gap-3">
                  <span>Story</span>
                  {['Readers', 'Completion', 'Comments', 'Saves', 'Likes'].map((head) => (
                    <span key={head} className="text-right">
                      {head}
                    </span>
                  ))}
                </div>
                <ul>
                  {rows.map((row) => (
                    <li
                      key={row.storyId}
                      className="grid gap-x-3 gap-y-2 border-b border-line-soft py-3 last:border-0 lg:grid-cols-[minmax(0,1fr)_repeat(5,80px)] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-[15px] text-ink">{row.title}</div>
                        <div className="text-xs text-muted">
                          {row.categoryName} · {row.partCount}{' '}
                          {row.partCount === 1 ? 'part' : 'parts'}
                        </div>
                      </div>
                      {/* Wraps as a row of labelled figures on a phone; becomes
                          the five columns on a desk. */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 lg:contents">
                        <Figure label="Readers" value={formatCount(row.readers)} />
                        <Figure label="Completion" value={`${row.completion}%`} />
                        <Figure label="Comments" value={formatCount(row.comments)} />
                        <Figure label="Saves" value={formatCount(row.saves)} />
                        <Figure label="Likes" value={formatCount(row.likes)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        </Async>
      </Panel>
    </div>
  )
}

/**
 * One number from the performance list. Its label is shown on a phone, where
 * nothing else says what the figure is, and hidden from `lg`, where the column
 * header does.
 */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-sm lg:text-right lg:tabular-nums">
      <span className="text-xs text-muted lg:hidden">{label} </span>
      <span className="tabular-nums text-ink">{value}</span>
    </span>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border border-line-card bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 font-display text-[26px] text-ink">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  )
}

/**
 * The drop-off across a series. This is the number that tells the creator how
 * long the next series should run, so it is the one chart on the dashboard.
 */
function SeriesRetention() {
  const stories = useStorySummaries()
  const series = stories.data?.filter((story) => story.parts.length > 1) ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const storyId = selected ?? series[0]?.id
  const retention = useSeriesRetention(storyId)

  if (series.length === 0) return null

  return (
    <Panel
      title="Series retention"
      actions={
        <select
          value={storyId}
          onChange={(event) => setSelected(event.target.value)}
          // A select is as wide as its widest option unless told otherwise,
          // and these options are story titles.
          className="w-full max-w-full rounded-lg border border-line-card bg-surface px-3 py-1.5 text-sm text-ink sm:w-auto"
        >
          {series.map((story) => (
            <option key={story.id} value={story.id}>
              {story.title}
            </option>
          ))}
        </select>
      }
    >
      <Async query={retention} loading={<div className="h-28 animate-pulse rounded bg-surface-tint" />}>
        {(points) => (
          <div className="flex flex-col gap-3">
            {points.map((point) => (
              <div key={point.partNumber} className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-xs text-muted">Part {point.partNumber}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-surface-tint">
                  <div
                    className={`h-full rounded ${point.partNumber === 1 ? 'bg-ink' : 'bg-accent'}`}
                    style={{ width: `${Math.max(point.share, point.readers > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="w-40 shrink-0 text-right text-xs text-muted tabular-nums">
                  {point.publishedAt === null
                    ? 'not scheduled'
                    : point.publishedAt > new Date()
                      ? `scheduled ${point.publishedAt.toLocaleDateString('en-GB')}`
                      : `${formatCount(point.readers)} readers · ${point.share}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Async>
    </Panel>
  )
}
