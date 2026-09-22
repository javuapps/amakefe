import { useEffect, useState } from 'react'
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
import { CommentsSheet } from '../components/CommentsSheet'
import { SupportAsk } from '../components/SupportAsk'
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
  const [readingComments, setReadingComments] = useState(false)

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
    /**
     * On a phone this is one column, exactly as designed. From `lg` the prose
     * keeps a readable measure and everything *around* the reading — where you
     * are in the series, the reaction, what to read next — moves into a rail
     * beside it instead of queueing underneath.
     *
     * The desktop classes live here and never inside `StoryReading`: that
     * component is also what the studio renders in its 402px phone frame, and
     * `lg:` is a viewport query, not a container one — a `lg:` rule added there
     * would fire inside the preview and show the creator a phone that is not a
     * phone.
     */
    <article className="lg:mx-auto lg:flex lg:w-full lg:max-w-[1080px] lg:items-start lg:gap-10 lg:px-6 lg:pt-6 lg:pb-16">
      <div className="lg:min-w-0 lg:flex-1">
      <div className="sticky top-0 z-5 flex items-center justify-between bg-surface/95 px-5 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 backdrop-blur-sm lg:static lg:px-0 lg:pt-0">
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
          className={`text-[13px] font-semibold lg:hidden ${saved ? 'text-accent' : 'text-body'}`}
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
          <nav className="flex gap-[10px] px-[22px] pt-[22px] lg:hidden">
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

      </div>

      <aside className="lg:sticky lg:top-6 lg:w-[272px] lg:shrink-0 lg:space-y-5">
      {/* One block for everything the reader can do with this story. On a
          phone it is a row under the prose; in the rail it is a card, so the
          heart is not left floating at the top of an empty column. */}
      <div className="mx-[22px] mt-[22px] flex items-center gap-[22px] border-t border-line-soft pt-4 lg:mx-0 lg:mt-0 lg:gap-4 lg:rounded-card lg:border lg:border-line-card lg:border-t lg:p-4">
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
        {/* Reading needs no account, so this one never asks for one — the
            thread is public and the sheet asks only when somebody writes. */}
        <button
          type="button"
          onClick={() => setReadingComments(true)}
          className="flex items-center gap-2 text-sm text-body"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 20.5l1.6-4.8A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
          </svg>
          {formatCount(story.card.commentCount)}
          <span className="sr-only">comments</span>
        </button>
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
          className={`hidden text-sm font-semibold lg:block ${saved ? 'text-accent' : 'text-body'}`}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* The rail's own copy of the part controls, which the footer hides from
          `lg` — beside the prose they are a place in the series rather than a
          thing to scroll to the end for. */}
      <nav className="hidden gap-[10px] lg:flex">
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
            {atEnd ? (seriesComplete ? 'Finish' : `Part ${partNumber + 1} is coming`) : 'Next part →'}
          </Pill>
        )}
      </nav>

      {related.data && related.data.length > 0 && (
        <section className="px-[22px] pt-6 pb-8 lg:px-0 lg:pt-0 lg:pb-0">
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

      {/* Last, and after every way onward — the part nav above it and the
          related stories above that. An ask a reader has to scroll past to
          carry on reading is an ask in the way.
          
          It is shown every time rather than once a session. That limit was
          written when this sat in the reading flow at the end of a part, where
          repeating it through a six-part series would be pestering someone who
          is reading. In a rail it is furniture, not an interruption, and a
          sidebar that carries it on one story and not the next reads as a bug
          — which is how it was reported. */}
      <div className="px-[22px] pt-6 pb-8 lg:px-0 lg:pt-0 lg:pb-0">
        <SupportAsk placement="story_end" />
      </div>
      </aside>

      {readingComments && (
        <CommentsSheet story={story.card} onClose={() => setReadingComments(false)} />
      )}

      {signIn.node}
    </article>
  )
}

const resolveImage = (path: string): string | null =>
  db.storage.from('public_media').getPublicUrl(path).data.publicUrl

const coverUrl = (path: string | null): string | null => (path ? resolveImage(path) : null)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

