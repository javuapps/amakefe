import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  formatDate,
  publicUrl,
  storyInitial,
  STORIES_PER_PAGE,
  STORY_STATUSES,
  type StoryFilters,
  type StoryStatus,
  type StudioStoryRow,
} from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { useNewStory } from '../components/NewStoryDialog'
import { useCategories, useStudioStories, useStudioTotals } from '../hooks/queries'
import { db } from '../db'

/**
 * Every story, as a feed.
 *
 * One row each — what it is, what it is called, how far it has got — rather than
 * a card per story with every part spelled out inside it. The parts belong to
 * the story's own page; repeating them here made a list of seven stories as long
 * as a page of prose and buried the thing you came to scan for.
 *
 * Search, filters and the page number live in the URL, so the back button works,
 * a reload keeps your place, and a filtered list can be sent to someone. They go
 * to Postgres rather than being applied to an array here — a filter that runs in
 * the browser has to fetch every story to count them, which is the thing paging
 * exists to avoid.
 */
export function StoriesScreen() {
  const [params, setParams] = useSearchParams()
  const openNewStory = useNewStory()
  const categories = useCategories()

  const filters: StoryFilters = {
    search: params.get('q') ?? '',
    status: (params.get('status') as StoryStatus) || null,
    categorySlug: params.get('category') || null,
    page: Number(params.get('page')) || 1,
  }
  const stories = useStudioStories(filters)

  /** Any change but the page itself puts you back on page one. */
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const filtered = Boolean(filters.search || filters.status || filters.categorySlug)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={filters.search ?? ''} onChange={(value) => setFilter('q', value)} />

        <select
          value={filters.status ?? ''}
          onChange={(event) => setFilter('status', event.target.value)}
          className={selectClass}
        >
          <option value="">Any status</option>
          {STORY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={filters.categorySlug ?? ''}
          onChange={(event) => setFilter('category', event.target.value)}
          className={selectClass}
        >
          <option value="">Any category</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams())}
            className="text-xs text-accent"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={openNewStory}
          className="ml-auto shrink-0 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
        >
          New story
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Async query={stories}>
            {({ rows, total }) => (
              <>
                <p className="text-[13px] text-muted">
                  {total} {total === 1 ? 'story' : 'stories'}
                  {filtered && ' match'}
                </p>

                {rows.length === 0 ? (
                  <Panel>
                    <p className="text-sm text-body">
                      {filtered
                        ? 'No story matches those filters.'
                        : 'Nothing written yet. Start a story and it will appear here.'}
                    </p>
                  </Panel>
                ) : (
                  <Panel>
                    <div className="flex flex-col">
                      {rows.map((story) => (
                        <StoryRow key={story.id} story={story} />
                      ))}
                    </div>
                  </Panel>
                )}

                <Pagination
                  page={filters.page ?? 1}
                  total={total}
                  onPage={(page) => setFilter('page', page === 1 ? '' : String(page))}
                />
              </>
            )}
          </Async>
        </div>

        <Sidebar />
      </div>
    </div>
  )
}

/** The numbers, and what they are attached to. */
function Sidebar() {
  const totals = useStudioTotals()
  const popular = useStudioStories({ sort: 'popular', pageSize: 5 })

  return (
    <aside className="flex flex-col gap-5">
      <Panel title="This week">
        <Async query={totals} loading={<div className="h-24 animate-pulse rounded-lg bg-surface-tint" />}>
          {(data) =>
            data && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="reads" value={data.views7d} />
                <Stat label="reactions" value={data.reactions} />
                <Stat label="comments" value={data.comments} />
              </div>
            )
          }
        </Async>
      </Panel>

      <Panel title="Everything so far">
        <Async query={totals} loading={<div className="h-16 animate-pulse rounded-lg bg-surface-tint" />}>
          {(data) =>
            data && (
              <dl className="flex flex-col gap-2 text-[13px]">
                <Line label="Stories" value={data.stories} />
                <Line label="Out" value={data.published} />
                <Line label="Drafts" value={data.drafts} />
                <Line label="Reads" value={data.views} />
              </dl>
            )
          }
        </Async>
      </Panel>

      <Panel title="Most read">
        <Async query={popular} loading={<div className="h-32 animate-pulse rounded-lg bg-surface-tint" />}>
          {({ rows }) =>
            rows.every((story) => story.viewCount7d === 0) ? (
              <p className="text-xs text-muted">
                Nothing has been read this week yet. Reads are counted per part, without recording
                who read it.
              </p>
            ) : (
              <ol className="flex flex-col">
                {rows
                  .filter((story) => story.viewCount7d > 0)
                  .map((story) => (
                    <li key={story.id} className="border-t border-line-soft py-3 first:border-0 first:pt-0">
                      <Link
                        to={`/stories/${story.id}`}
                        className="text-[13px] font-semibold leading-snug text-ink hover:text-accent-deep"
                      >
                        {story.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {story.viewCount7d.toLocaleString('en-GB')}{' '}
                        {story.viewCount7d === 1 ? 'read' : 'reads'} this week
                      </p>
                    </li>
                  ))}
              </ol>
            )
          }
        </Async>
      </Panel>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-[22px] leading-none text-ink">
        {value.toLocaleString('en-GB')}
      </div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value.toLocaleString('en-GB')}</dd>
    </div>
  )
}

const selectClass =
  'rounded-lg border border-line-card bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-line-strong'

const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
}

const STATUS_TONES: Record<StoryStatus, string> = {
  draft: 'text-muted',
  scheduled: 'text-gold',
  publishing: 'text-green',
  published: 'text-green',
}

/**
 * Debounced, so typing does not fire a query per keystroke, and uncontrolled by
 * the URL while you are typing — writing to `params` on every letter would put
 * the caret back at the start.
 */
function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder="Search titles and summaries"
      className="min-w-0 flex-1 rounded-lg border border-line-card bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-line-strong sm:max-w-xs"
    />
  )
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.ceil(total / STORIES_PER_PAGE)
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-body disabled:opacity-40"
      >
        ← Newer
      </button>
      <span className="text-xs text-muted">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-body disabled:opacity-40"
      >
        Older →
      </button>
    </div>
  )
}

/**
 * One figure in the meta line.
 *
 * Unicode, not an icon set — the sidebar's glyphs are the same vocabulary, and
 * a pictogram library would be a dependency for six characters. The glyph is
 * decoration over the word beside it, so it is hidden from screen readers
 * rather than read out as punctuation.
 */
function Meta({ glyph, children }: { glyph: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="text-[13px] leading-none text-muted">
        {glyph}
      </span>
      {children}
    </span>
  )
}

function StoryRow({ story }: { story: StudioStoryRow }) {
  const isSeries = story.storyType === 'series'
  const cover = publicUrl(db, story.coverImagePath)

  return (
    // The whole row is the link, as in any feed: there is one thing to do with a
    // story from here, and that is open it.
    <Link
      to={`/stories/${story.id}`}
      className="group flex items-start gap-6 border-t border-line-soft py-6 first:border-0 first:pt-0 last:pb-0"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs text-muted">
          {story.categoryName} · {isSeries ? `Series of ${story.plannedPartCount}` : 'One story'}
          {story.firstPublishedAt && ` · ${formatDate(story.firstPublishedAt)}`}
        </p>

        <h2 className="mt-2 font-display text-[21px] leading-snug text-ink group-hover:text-accent-deep">
          {story.title}
        </h2>

        {story.summary && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-body">
            {story.summary}
          </p>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className={`flex items-center gap-1.5 ${STATUS_TONES[story.status]}`}>
            <span aria-hidden>●</span>
            {STATUS_LABELS[story.status]}
          </span>
          {isSeries && (
            <Meta glyph="❏">
              {story.livePartCount} of {story.plannedPartCount} parts out
            </Meta>
          )}
          <Meta glyph="¶">{story.wordCount.toLocaleString('en-GB')} words</Meta>
          {story.status !== 'draft' && (
            <>
              <Meta glyph="◎">
                {story.viewCount.toLocaleString('en-GB')} {story.viewCount === 1 ? 'read' : 'reads'}
              </Meta>
              <Meta glyph="♥">
                {story.reactionCount.toLocaleString('en-GB')}{' '}
                {story.reactionCount === 1 ? 'reaction' : 'reactions'}
              </Meta>
              <Meta glyph="❝">
                {story.commentCount.toLocaleString('en-GB')}{' '}
                {story.commentCount === 1 ? 'comment' : 'comments'}
              </Meta>
            </>
          )}
        </p>
      </div>

      {/* The cover if there is one, the prototype's lettered tile if not — the
          same fallback the reader uses, so a story looks like itself in both. */}
      {cover ? (
        <img src={cover} alt="" className="aspect-[3/2] w-[132px] shrink-0 rounded-lg object-cover" />
      ) : (
        <div
          aria-hidden
          className="flex aspect-[3/2] w-[132px] shrink-0 items-center justify-center rounded-lg bg-surface-warm font-display text-[28px] text-line-strong"
        >
          {storyInitial(story)}
        </div>
      )}
    </Link>
  )
}
