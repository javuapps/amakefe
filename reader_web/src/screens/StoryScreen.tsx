import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  canonicalPath,
  formatCount,
  isSeries,
  recordStoryView,
  storyMeta,
  type Story,
} from '@amakefe/core'
import { StoryReading } from '@amakefe/ui'
import portrait from '@amakefe/core/brand/portrait.webp'
import { Async, Pill } from '../components/primitives'
import { db } from '../db'
import { useSignInPrompt } from '../hooks/useSignInPrompt'
import {
  useRecordProgress,
  useRelated,
  useSavedIds,
  useStory,
  useToggleReaction,
  useToggleSaved,
} from '../hooks/queries'

/**
 * The reading screen. The spec calls this the most important experience in the
 * product, so it stays quiet: no chrome competing with the prose, one clear way
 * forward through the series.
 *
 * The prose itself is rendered by @amakefe/ui, the same component the studio
 * previews a draft with — so what the creator sees before publishing is what a
 * reader gets.
 */
export function StoryScreen() {
  const { slug = '', part } = useParams()
  const story = useStory(slug)
  const requested = Number(part) || 1

  return (
    <Async
      query={story}
      loading={
        <div className="p-6">
          <div className="h-64 animate-pulse rounded-card bg-surface-tint" />
        </div>
      }
    >
      {(data) => <StoryBody story={data} slug={slug} requested={requested} />}
    </Async>
  )
}

function StoryBody({
  story,
  slug,
  requested,
}: {
  story: Story
  slug: string
  requested: number
}) {
  const navigate = useNavigate()
  const partCount = story.parts.length
  const partNumber = clamp(requested, 1, Math.max(partCount, 1))
  const series = isSeries(story.card)

  const recordProgress = useRecordProgress()
  const savedIds = useSavedIds()
  const toggleSaved = useToggleSaved()
  const toggleReaction = useToggleReaction(slug)
  const related = useRelated(story.card)
  const signIn = useSignInPrompt()

  const saved = savedIds.data?.has(story.card.id) ?? false
  const part = story.parts[partNumber - 1]
  const atEnd = partNumber >= partCount
  const seriesComplete = story.card.partCount >= story.card.totalPartCount

  useEffect(() => {
    if (partCount === 0) return
    // Not a gesture the reader made, so a missing account is not worth
    // interrupting them for — their place simply is not kept until they sign in.
    recordProgress.mutate(
      { storyId: story.card.id, part: partNumber },
      { onError: () => undefined },
    )

    // Counted once per part per browser session. Without the guard every
    // back-and-forth through a series inflates the number, and the creator
    // would be reading her own navigation as readership.
    const seen = `viewed:${story.card.id}:${partNumber}`
    try {
      if (!sessionStorage.getItem(seen)) {
        sessionStorage.setItem(seen, '1')
        void recordStoryView(db, story.card.id, partNumber)
      }
    } catch {
      // Private windows and blocked site data throw here; count it and move on.
      void recordStoryView(db, story.card.id, partNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.card.id, partNumber, partCount])

  const goToPart = (next: number) => {
    const target = clamp(next, 1, partCount)
    navigate(canonicalPath(slug, { part: target, isSeries: series }))
    window.scrollTo({ top: 0 })
  }

  if (!part) {
    return <p className="p-6 text-sm text-muted">This story has not been published yet.</p>
  }

  return (
    <article>
      <div className="sticky top-0 z-5 flex items-center justify-between bg-surface/95 px-5 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 backdrop-blur-sm">
        <Link to="/stories" className="flex items-center gap-1 text-sm text-body">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>
        <button
          type="button"
          onClick={() =>
            toggleSaved.mutate(story.card.id, {
              onError: (error) =>
                signIn.onError(error, 'Save this for later?', () =>
                  toggleSaved.mutate(story.card.id),
                ),
            })
          }
          className={`text-[13px] font-semibold ${saved ? 'text-accent' : 'text-body'}`}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <StoryReading
        title={story.card.title}
        categoryName={story.card.categoryName}
        publishedAt={story.card.publishedAt}
        readMinutes={story.card.readMinutes}
        isSeries={series}
        partNumber={partNumber}
        totalPartCount={story.card.totalPartCount}
        partTitle={part.title}
        body={part.body}
        creatorNote={part.creatorNote}
        coverUrl={coverUrl(part.thumbnailPath ?? story.card.coverImagePath)}
        resolveImage={resolveImage}
        markUrl={portrait}
        footer={
          <nav className="flex gap-[10px] px-[22px] pt-[22px]">
            {partNumber > 1 && (
              <Pill variant="quiet" className="flex-1" onClick={() => goToPart(partNumber - 1)}>
                ← Previous
              </Pill>
            )}
            {series && (
              <Pill
                variant={atEnd && !seriesComplete ? 'quiet' : 'ink'}
                className="flex-1"
                disabled={atEnd}
                onClick={() => goToPart(partNumber + 1)}
              >
                {/* On the last published part of a series still running there is
                    no next part to offer — say so rather than showing a dead
                    button. */}
                {atEnd
                  ? seriesComplete
                    ? 'Finish'
                    : `Part ${partNumber + 1} is coming`
                  : 'Next part →'}
              </Pill>
            )}
          </nav>
        }
      />

      <div className="mx-[22px] mt-[22px] flex items-center gap-[22px] border-t border-line-soft pt-4">
        <button
          type="button"
          onClick={() =>
            toggleReaction.mutate(story.card.id, {
              onError: (error) =>
                signIn.onError(error, 'Let her know this reached you?', () =>
                  toggleReaction.mutate(story.card.id),
                ),
            })
          }
          className="flex items-center gap-2 text-sm text-body"
        >
          <span className="text-accent">♥</span>
          {formatCount(story.card.likeCount)}
        </button>
      </div>

      {related.data && related.data.length > 0 && (
        <section className="px-[22px] pt-6 pb-8">
          <h3 className="font-display text-[19px] text-ink">Related stories</h3>
          <div className="mt-3">
            {related.data.map((other) => (
              <Link
                key={other.id}
                to={canonicalPath(other.slug)}
                className="block border-t border-line-soft py-[13px]"
              >
                <div className="font-display text-base text-ink">{other.title}</div>
                <div className="mt-1 text-xs text-muted">{storyMeta(other)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {signIn.node}
    </article>
  )
}

const resolveImage = (path: string): string | null =>
  db.storage.from('public_media').getPublicUrl(path).data.publicUrl

const coverUrl = (path: string | null): string | null => (path ? resolveImage(path) : null)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
