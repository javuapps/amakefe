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
              <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Story</th>
                    <th className="pb-2 text-right font-normal">Readers</th>
                    <th className="pb-2 text-right font-normal">Completion</th>
                    <th className="pb-2 text-right font-normal">Comments</th>
                    <th className="pb-2 text-right font-normal">Saves</th>
                    <th className="pb-2 text-right font-normal">Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.storyId} className="border-b border-line-soft last:border-0">
                      <td className="py-3">
                        <div className="font-display text-[15px] text-ink">{row.title}</div>
                        <div className="text-xs text-muted">
                          {row.categoryName} · {row.partCount} {row.partCount === 1 ? 'part' : 'parts'}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{formatCount(row.readers)}</td>
                      <td className="text-right tabular-nums">{row.completion}%</td>
                      <td className="text-right tabular-nums">{formatCount(row.comments)}</td>
                      <td className="text-right tabular-nums">{formatCount(row.saves)}</td>
                      <td className="text-right tabular-nums">{formatCount(row.likes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </Async>
      </Panel>
    </div>
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
          className="max-w-full rounded-lg border border-line-card bg-surface px-3 py-1.5 text-sm text-ink"
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
