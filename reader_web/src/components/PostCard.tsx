import { useState } from 'react'
import { formatCount, formatRelative, postState, type CommunityPost } from '@amakefe/core'
import { Card, SectionLabel } from './primitives'
import { Mark } from './Mark'
import { Byline, PostDetail } from './PostDetail'
import { useReactedPosts, useTogglePostReaction } from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

/**
 * One post in the feed — a preview, not the whole thing.
 *
 * Long bodies are clipped rather than allowed to push everything else off the
 * screen: a feed is for deciding what to read, and a post that fills the
 * viewport has stopped being a feed item. Tapping it opens the full post with
 * its comments, which is what the counts underneath are promising.
 *
 * The heart stays on the card, because reacting is not a reason to leave the
 * feed. Everything else is behind the tap.
 */
export function PostCard({ post }: { post: CommunityPost }) {
  const [open, setOpen] = useState(false)
  const reacted = useReactedPosts()
  const react = useTogglePostReaction()
  const signIn = useSignInPrompt()

  const mine = reacted.data?.has(post.id) ?? false
  const notice = post.kind === 'notice'

  return (
    <>
      <Card className={`flex flex-col gap-3 ${notice ? 'bg-surface-raised' : ''}`}>
        {notice ? <Byline post={post} /> : <Header post={post} />}

        {/* The whole body is the target, so a tap anywhere in the text opens
            it — the way a post works everywhere else. */}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col gap-3 text-left">
          {post.kind === 'poll' ? (
            <h3 className="font-display text-[19px] leading-snug text-ink">{post.body}</h3>
          ) : (
            <p className="prose-story line-clamp-4 text-[15px] leading-relaxed">{post.body}</p>
          )}

          {post.answer && (
            <div className="flex gap-3 border-t border-line-soft pt-3">
              <Mark size={30} />
              <p className="prose-story line-clamp-3 flex-1 text-[14.5px]">{post.answer}</p>
            </div>
          )}

          {post.kind === 'poll' && (
            <span className="text-xs text-muted">
              {post.voteCount === 0
                ? 'No votes yet — tap to vote'
                : `${formatCount(post.voteCount)} ${post.voteCount === 1 ? 'vote' : 'votes'} · tap to vote`}
            </span>
          )}
        </button>

        <div className="flex items-center gap-5 border-t border-line-soft pt-3 text-sm">
          <button
            type="button"
            onClick={() =>
              react.mutate(post.id, {
                onError: (error) =>
                  signIn.onError(error, 'Let her know this reached you?', () =>
                    react.mutate(post.id),
                  ),
              })
            }
            className={`flex items-center gap-2 ${mine ? 'text-accent' : 'text-body'}`}
          >
            <span aria-hidden>{mine ? '♥' : '♡'}</span>
            {formatCount(post.likeCount)}
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-body"
          >
            <span aria-hidden>❝</span>
            {formatCount(post.commentCount)}
          </button>
        </div>
      </Card>

      {open && <PostDetail post={post} onClose={() => setOpen(false)} />}
      {signIn.node}
    </>
  )
}

function Header({ post }: { post: CommunityPost }) {
  const when = post.publishedAt ?? post.answeredAt

  return (
    <div className="flex items-baseline justify-between gap-3">
      <SectionLabel tone={post.kind === 'poll' ? 'gold' : 'muted'}>
        {post.kind === 'poll'
          ? 'Poll'
          : postState(post) === 'published'
            ? 'She answered'
            : 'Waiting for her'}
      </SectionLabel>
      {when && <span className="text-xs text-muted">{formatRelative(when)}</span>}
    </div>
  )
}
