import { useEffect, useState } from 'react'
import { formatCount, formatRelative, optionShare, type CommunityPost } from '@amakefe/core'
import { Mark } from './Mark'
import { SectionLabel } from './primitives'
import {
  useCastVote,
  usePollDetail,
  usePostComment,
  usePostComments,
  useReactedPosts,
  useTogglePostReaction,
} from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

/**
 * One post, in full.
 *
 * The feed clips; this is where the whole thing lives, with its comments and —
 * for a poll — the buttons that actually vote. It fills the screen rather than
 * arriving from the side: on a phone this *is* the page you moved to, and the
 * feed behind it is not something you need to see while reading a reply.
 */
export function PostDetail({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // The feed must not scroll underneath while this is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    /**
     * Full screen at every width, which on desktop means the whole window
     * rather than a phone-shaped strip down the middle of it. A 520px column
     * floating in a 1440px page is a mobile modal that forgot where it was —
     * and this is the screen you moved to, not a peek at one.
     *
     * The chrome spans the window; the reading does not. The body is capped to
     * a measure inside it, the same way the settlement statement is.
     */
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-[520px] flex-col bg-surface lg:max-w-none">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line-soft px-5 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 lg:px-8 lg:py-[18px]">
          <span className="font-display text-[17px] text-ink lg:text-[21px]">
            {post.kind === 'poll' ? 'Poll' : post.kind === 'notice' ? 'From Amake Fe' : 'Question'}
          </span>
          <button type="button" onClick={onClose} className="text-sm text-body">
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:px-8 lg:py-8">
          <div className="lg:mx-auto lg:w-full lg:max-w-[680px]">
            <Body post={post} />
            <Engagement post={post} />
            <Comments postId={post.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Body({ post }: { post: CommunityPost }) {
  if (post.kind === 'poll') return <Poll post={post} />

  return (
    <div className="flex flex-col gap-4">
      {post.kind === 'notice' && <Byline post={post} />}
      <p className="prose-story text-[15.5px] leading-relaxed">{post.body}</p>
      {post.answer && (
        <div className="flex gap-3 border-t border-line-soft pt-4">
          <Mark size={32} />
          <p className="prose-story flex-1 text-[15px]">{post.answer}</p>
        </div>
      )}
    </div>
  )
}

/** Her posts carry her name and face, the way they did before the timeline. */
export function Byline({ post }: { post: CommunityPost }) {
  return (
    <div className="flex items-center gap-[10px]">
      <Mark size={32} />
      <div>
        <div className="text-sm font-semibold text-ink">Amake Fe</div>
        <div className="text-[11px] text-muted">
          {post.publishedAt ? formatRelative(post.publishedAt) : 'Not published'}
        </div>
      </div>
    </div>
  )
}

function Poll({ post }: { post: CommunityPost }) {
  const detail = usePollDetail(post.id, true)
  const vote = useCastVote()
  const signIn = useSignInPrompt()

  const options = detail.data?.options ?? []
  const total = options.reduce((sum, option) => sum + option.voteCount, 0)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-[21px] leading-snug text-ink">{post.body}</h2>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const share = optionShare(total, option)
          const chosen = detail.data?.myOptionId === option.optionId
          return (
            <button
              key={option.optionId}
              type="button"
              disabled={vote.isPending}
              onClick={() =>
                vote.mutate(
                  { postId: post.id, optionId: option.optionId },
                  {
                    onError: (error) =>
                      signIn.onError(error, 'Add your vote?', () =>
                        vote.mutate({ postId: post.id, optionId: option.optionId }),
                      ),
                  },
                )
              }
              className={`relative flex items-center justify-between overflow-hidden rounded-tile border px-[14px] py-[11px] text-sm ${
                chosen ? 'border-accent' : 'border-line-card'
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-surface-warm transition-[width] duration-300"
                style={{ width: `${Math.round(share * 100)}%` }}
                aria-hidden
              />
              <span className={`relative font-medium ${chosen ? 'text-accent' : 'text-ink'}`}>
                {option.label}
              </span>
              <span className="relative text-muted">{Math.round(share * 100)}%</span>
            </button>
          )
        })}
      </div>
      <div className="text-xs text-muted">
        {total === 0 ? 'No votes yet' : `${formatCount(total)} ${total === 1 ? 'vote' : 'votes'}`}
      </div>
      {signIn.node}
    </div>
  )
}

function Engagement({ post }: { post: CommunityPost }) {
  const reacted = useReactedPosts()
  const react = useTogglePostReaction()
  const signIn = useSignInPrompt()
  const mine = reacted.data?.has(post.id) ?? false

  return (
    <div className="mt-4 flex items-center gap-5 border-t border-line-soft pt-3 text-sm">
      <button
        type="button"
        onClick={() =>
          react.mutate(post.id, {
            onError: (error) =>
              signIn.onError(error, 'Let her know this reached you?', () => react.mutate(post.id)),
          })
        }
        className={`flex items-center gap-2 ${mine ? 'text-accent' : 'text-body'}`}
      >
        <span aria-hidden>{mine ? '♥' : '♡'}</span>
        {formatCount(post.likeCount)}
      </button>
      <span className="flex items-center gap-2 text-muted">
        <span aria-hidden>❝</span>
        {formatCount(post.commentCount)}
      </span>
      {signIn.node}
    </div>
  )
}

function Comments({ postId }: { postId: string }) {
  const comments = usePostComments(postId, true)
  const add = usePostComment()
  const signIn = useSignInPrompt()
  const [body, setBody] = useState('')

  const send = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    add.mutate(
      { postId, body: trimmed },
      {
        onSuccess: () => setBody(''),
        onError: (error) =>
          signIn.onError(error, 'Join the conversation?', () =>
            add.mutate({ postId, body: trimmed }, { onSuccess: () => setBody('') }),
          ),
      },
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <SectionLabel>Comments</SectionLabel>

      {(comments.data ?? []).length === 0 && (
        <p className="text-sm text-muted">No comments yet. Be the first to say something.</p>
      )}

      {(comments.data ?? []).map((comment) => (
        <div key={comment.id} className="flex flex-col gap-1">
          <div className="text-xs text-muted">
            {comment.authorName ?? 'Someone'} · {formatRelative(comment.createdAt)}
          </div>
          <p className="prose-story text-[14.5px]">{comment.body}</p>
        </div>
      ))}

      <div className="flex flex-col gap-2 pt-1">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Say something kind…"
          className="w-full resize-none rounded-tile border border-line-card bg-surface-raised p-3 font-prose text-[15px] leading-relaxed text-ink outline-none placeholder:text-subtle focus:border-accent"
        />
        <button
          type="button"
          onClick={send}
          disabled={!body.trim() || add.isPending}
          className="self-end rounded-full bg-ink px-[18px] py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
        >
          {add.isPending ? 'Sending…' : 'Comment'}
        </button>
      </div>
      {signIn.node}
    </div>
  )
}
