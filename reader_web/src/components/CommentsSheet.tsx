import { useEffect, useState } from 'react'
import { formatCount, formatRelative, type StoryCard } from '@amakefe/core'
import {
  usePostStoryComment,
  useReactedComments,
  useStoryComments,
  useToggleCommentReaction,
} from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'
import { Async } from './primitives'

/**
 * What readers have said about a story.
 *
 * A drawer on a desk and a full-screen modal in a hand — `.sheet-panel` in
 * tokens.css carries that difference, so this only has to say where to put it.
 * The distinction is real rather than decorative: on a monitor the comments
 * arrive beside a story you are still reading, and on a phone they are the
 * screen you moved to, because there is no beside.
 *
 * Comments are **per story, not per part**. A six-part series is one
 * conversation; splitting it per part would scatter a thread across screens
 * most readers never reach, and `com_comments.story_id` has always said so.
 */
export function CommentsSheet({ story, onClose }: { story: StoryCard; onClose: () => void }) {
  const comments = useStoryComments(story.id, true)
  const ids = comments.data?.map((comment) => comment.id) ?? []
  const reacted = useReactedComments(story.id, ids, comments.isSuccess)
  const post = usePostStoryComment(story.slug)
  const react = useToggleCommentReaction(story.id)
  const signIn = useSignInPrompt()

  const [draft, setDraft] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const send = () => {
    const body = draft.trim()
    if (!body) return
    post.mutate(
      { storyId: story.id, body },
      {
        onSuccess: () => setDraft(''),
        onError: (error) =>
          signIn.onError(error, 'Say something about this story?', () =>
            post.mutate({ storyId: story.id, body }, { onSuccess: () => setDraft('') }),
          ),
      },
    )
  }

  return (
    <div
      // Centred below `lg` and against the right edge above it: the same panel
      // arriving the way each shape expects.
      className="modal-scrim fixed inset-0 z-50 flex justify-center bg-ink/40 lg:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Comments on ${story.title}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="sheet-panel flex h-full w-full max-w-[520px] flex-col bg-surface lg:max-w-[480px] lg:border-l lg:border-line">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line-soft px-5 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 lg:px-6 lg:py-4">
          <span className="font-display text-[17px] text-ink">
            {/* "Comments" with none yet, rather than a bare "0 comments" that
                counts an absence, or the lowercase fragment the count left
                behind when it was empty. */}
            {story.commentCount === 0
              ? 'Comments'
              : story.commentCount === 1
                ? '1 comment'
                : `${formatCount(story.commentCount)} comments`}
          </span>
          <button type="button" onClick={onClose} className="text-sm text-body">
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:px-6">
          <Async query={comments}>
            {(list) =>
              list.length === 0 ? (
                <p className="py-6 text-sm text-muted">
                  No comments yet. Be the first to say something.
                </p>
              ) : (
                <ul className="flex flex-col gap-5">
                  {list.map((comment) => (
                    <li key={comment.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {comment.authorName ?? 'A reader'}
                        </span>
                        <span className="text-[11px] text-muted">
                          {formatRelative(comment.createdAt)}
                        </span>
                      </div>
                      <p className="prose-story mt-1 text-[15px]">{comment.body}</p>
                      <button
                        type="button"
                        onClick={() =>
                          react.mutate(comment.id, {
                            onError: (error) =>
                              signIn.onError(error, 'React to this comment?', () =>
                                react.mutate(comment.id),
                              ),
                          })
                        }
                        aria-pressed={reacted.data?.has(comment.id) ?? false}
                        className={`mt-2 flex items-center gap-1.5 text-xs ${
                          reacted.data?.has(comment.id) ? 'text-accent' : 'text-muted'
                        }`}
                      >
                        <span aria-hidden>♥</span>
                        {comment.likeCount > 0 ? formatCount(comment.likeCount) : 'Like'}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </Async>
        </div>

        {/* Pinned, so the box to write in is reachable without scrolling to the
            end of a long thread first. */}
        <div className="shrink-0 border-t border-line-soft px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] lg:px-6">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Say something kind…"
            className="auto-grow w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-accent"
          />
          {post.isError && !signIn.node && (
            <p className="mt-2 text-xs text-accent-deep">That did not send.</p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted">Posted under your name</span>
            <button
              type="button"
              onClick={send}
              disabled={draft.trim().length === 0 || post.isPending}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface-warm disabled:opacity-40"
            >
              {post.isPending ? 'Sending…' : 'Comment'}
            </button>
          </div>
        </div>
      </div>

      {signIn.node}
    </div>
  )
}
