import { Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { StoryProse } from '@amakefe/ui'
import {
  canonicalPath,
  docPlainText,
  formatDate,
  hasBlockingFinding,
  isSeriesStory,
  partState,
  publicUrl,
  scanForIdentifiers,
  type PartStats,
  type StoryComment,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { Async, BackLink, Panel } from '../components/shell'
import { useConfirm } from '../components/ConfirmDialog'
import { Menu } from '../components/Menu'
import { Tabs } from '../components/Tabs'
import { PartStudio } from '../components/write/lazyPartStudio'
import { PublishPanel } from '../components/write/PublishPanel'
import { FacebookPanel } from '../components/write/FacebookPanel'
import { PartImagePanel } from '../components/write/panels'
import {
  useDeletePart,
  usePartStats,
  useRefreshStory,
  useStoryComments,
  useStudioStory,
} from '../hooks/queries'
import { db } from '../db'

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL

/**
 * One part: what is in it, how it is doing, and what can be done with it.
 *
 * Writing is still the full-screen studio — this is the page you land on from
 * the story, where you read what is there and decide whether it goes out.
 */
export function PartDetailScreen() {
  const { storyId, partId } = useParams()
  const story = useStudioStory(storyId)
  const refreshStory = useRefreshStory(storyId)
  const [editing, setEditing] = useState(false)

  const closeStudio = useCallback(() => {
    setEditing(false)
    refreshStory()
  }, [refreshStory])

  return (
    <Async query={story}>
      {(data) => {
        const part = data.parts.find((candidate) => candidate.id === partId)
        if (!part) {
          return (
            <Panel>
              <p className="text-sm text-body">
                That part is no longer here.{' '}
                <Link to={`/stories/${data.id}`} className="text-accent">
                  Back to the story
                </Link>
                .
              </p>
            </Panel>
          )
        }

        return (
          <>
            <Part story={data} part={part} onEdit={() => setEditing(true)} />
            {editing && (
              <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#fbf7f0]" />}>
                <PartStudio story={data} partId={part.id} onClose={closeStudio} />
              </Suspense>
            )}
          </>
        )
      }}
    </Async>
  )
}

function Part({
  story,
  part,
  onEdit,
}: {
  story: StudioStory
  part: StudioPart
  onEdit: () => void
}) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const deletePart = useDeletePart(story.id)
  const stats = usePartStats(story.id, part.partNumber)
  const comments = useStoryComments(story.id)
  const [tab, setTab] = useState<'Content' | 'Comments'>('Content')

  const isSeries = isSeriesStory(story)
  const state = partState(part)
  const live = state !== 'draft'

  // The same scan the studio runs, over the same text: a phone number blocks
  // publishing from here exactly as it blocks it from there.
  const blocked = useMemo(
    () =>
      hasBlockingFinding(
        scanForIdentifiers(
          [story.title, story.summary, part.facebookTeaser ?? '', docPlainText(part.body)]
            .filter(Boolean)
            .join('\n\n'),
        ),
      ),
    [story.title, story.summary, part.facebookTeaser, part.body],
  )
  const label = isSeries ? `Part ${part.partNumber}` : 'The story'
  const canDelete = isSeries && story.parts.length > 1 && state === 'draft'

  const remove = async () => {
    const ok = await confirm({
      title: `Delete part ${part.partNumber}?`,
      body: 'It has not been published, so no reader has seen it. This cannot be undone.',
      confirmLabel: 'Delete part',
      tone: 'danger',
    })
    if (ok) {
      deletePart.mutate(part.id)
      navigate(`/stories/${story.id}`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start">
          <BackLink to={`/stories/${story.id}`}>{story.title}</BackLink>
          <h2 className="mt-3 font-display text-[26px] leading-tight text-ink">
            {label}
            {part.title && <span className="text-muted"> · {part.title}</span>}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-muted">
            <span
              className={
                state === 'live' ? 'text-green' : state === 'scheduled' ? 'text-gold' : 'text-muted'
              }
              aria-hidden
            >
              ●
            </span>
            {state === 'live'
              ? `Published ${formatDate(part.publishedAt!)}`
              : state === 'scheduled'
                ? `Scheduled for ${formatDate(part.publishedAt!)}`
                : 'Draft'}
            {' · '}
            {part.wordCount.toLocaleString('en-GB')} words
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
          >
            {part.wordCount > 0 ? 'Edit' : 'Write'}
          </button>
          <Menu
            items={[
              // Publishing, scheduling and the Facebook post are all in the
              // panel beside this, where their state is visible too. Repeating
              // them here would be a second way to do the same thing.
              ...(state === 'live'
                ? [
                    {
                      label: 'Open as a reader',
                      onSelect: () =>
                        window.open(
                          `${SITE_URL ?? ''}${canonicalPath(story.slug, {
                            part: part.partNumber,
                            isSeries,
                          })}`,
                          '_blank',
                          'noopener',
                        ),
                    },
                  ]
                : []),
              {
                label: 'Delete',
                onSelect: remove,
                tone: 'danger' as const,
                disabled: !canDelete,
                hint: live
                  ? 'Unpublish it first'
                  : !isSeries
                    ? 'A story keeps its one part'
                    : story.parts.length === 1
                      ? 'A series keeps at least one part'
                      : undefined,
              },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tabs
            value={tab}
            onChange={(label) => setTab(label as 'Content' | 'Comments')}
            items={[
              { label: 'Content' },
              {
                label: 'Comments',
                badge:
                  (comments.data?.length ?? 0) > 0 ? (
                    <span className="text-muted">{comments.data!.length}</span>
                  ) : undefined,
              },
            ]}
          />

          {tab === 'Content' ? (
            <div className="flex flex-col gap-5">
              <Panel title="What it says">
                {part.wordCount === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-body">Nothing written yet.</p>
                    <button
                      type="button"
                      onClick={onEdit}
                      className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
                    >
                      Write it
                    </button>
                  </div>
                ) : (
                  // As written, real names and all. The studio's phone frame is
                  // where she checks what readers actually get.
                  <article className="max-w-prose">
                    <StoryProse doc={part.body} resolveImage={(src) => publicUrl(db, src)} />
                  </article>
                )}
              </Panel>

              {part.creatorNote && (
                <Panel title="Amake Fe's thoughts">
                  <p className="prose-story max-w-prose text-[15px]">{part.creatorNote}</p>
                </Panel>
              )}
            </div>
          ) : (
            <Panel title={`Comments on ${isSeries ? 'the series' : 'this story'}`}>
              <Async
                query={comments}
                loading={<div className="h-16 animate-pulse rounded-lg bg-surface-tint" />}
              >
                {(list) =>
                  list.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      No comments yet. They are left on the story rather than on a single part, so
                      every part of a series shares them.
                    </p>
                  ) : (
                    <ul className="flex flex-col">
                      {list.map((comment) => (
                        <CommentRow key={comment.id} comment={comment} />
                      ))}
                    </ul>
                  )
                }
              </Async>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="How it is doing">
            <Async
              query={stats}
              loading={<div className="h-24 animate-pulse rounded-lg bg-surface-tint" />}
            >
              {(data) => <Stats stats={data} label={label} isSeries={isSeries} live={live} />}
            </Async>
          </Panel>

          {/* Where it goes and what goes with it. The studio next door is for
              the words; these are decisions about the part, and they are made
              here so they can also be seen here without opening an editor.

              In the order the thinking runs: settle the picture that travels
              with it, send it, then see where it got to. */}
          {isSeries && <PartImagePanel story={story} part={part} />}

          <PublishPanel story={story} part={part} privacyBlocked={blocked} />

          <FacebookPanel story={story} part={part} />
        </aside>
      </div>
    </div>
  )
}

function Stats({
  stats,
  label,
  isSeries,
  live,
}: {
  stats: PartStats
  label: string
  isSeries: boolean
  live: boolean
}) {
  if (!live) {
    return (
      <p className="text-[13px] text-muted">
        Nothing to show until it is published — readers cannot reach it yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Figure value={stats.views} label={`reads of ${label.toLowerCase()}`} />
        <Figure value={stats.views7d} label="this week" />
      </div>

      {/* Reactions and comments key on the story, not the part, so they are not
          presented as though they belonged to this one. */}
      <dl className="flex flex-col gap-2 border-t border-line-soft pt-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Reactions{isSeries && ' (whole series)'}</dt>
          <dd className="tabular-nums text-ink">{stats.storyReactions.toLocaleString('en-GB')}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Comments{isSeries && ' (whole series)'}</dt>
          <dd className="tabular-nums text-ink">{stats.storyComments.toLocaleString('en-GB')}</dd>
        </div>
      </dl>

      {stats.byDay.length > 0 && (
        <div className="border-t border-line-soft pt-3">
          <div className="text-xs text-muted">Reads by day</div>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byDay.map((day) => (
              <li key={day.day} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted">
                  {formatDate(new Date(`${day.day}T00:00:00Z`))}
                </span>
                <span
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.max(
                      4,
                      (day.views / Math.max(...stats.byDay.map((d) => d.views))) * 100,
                    )}%`,
                  }}
                />
                <span className="tabular-nums text-muted">{day.views}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[26px] leading-none text-ink">
        {value.toLocaleString('en-GB')}
      </div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}


function CommentRow({ comment }: { comment: StoryComment }) {
  return (
    <li className="border-t border-line-soft py-3 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{comment.authorName}</span>
        <span className="shrink-0 text-xs text-muted">{formatDate(comment.createdAt)}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-body">{comment.body}</p>
      {comment.hidden && <p className="mt-1 text-xs text-accent-deep">Hidden by moderation.</p>}
    </li>
  )
}
