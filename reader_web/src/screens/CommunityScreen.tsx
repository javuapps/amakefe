import { useEffect, useRef, useState } from 'react'
import { postState, type CommunityPost } from '@amakefe/core'
import { Async, Pill } from '../components/primitives'
import { PostCard } from '../components/PostCard'
import { Appear } from '@amakefe/ui'
import { Tabs } from '../components/Tabs'
import { useAskQuestion, useCommunityFeed, useMyQuestions } from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

/**
 * The community: one timeline.
 *
 * Questions she has answered, polls and notices share it, newest first, and
 * readers react and comment on any of them. Asking is the thing you came to do,
 * so the box is above the feed rather than behind a tab.
 *
 * "Your questions" is the second tab because a question waits before it is
 * answered, and a reader who has asked something wants to know it arrived. It
 * is the only place an unanswered question is visible — RLS shows a reader
 * their own, and nobody else's.
 */
type Tab = 'Feed' | 'Your questions'

export function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('Feed')
  const mine = useMyQuestions()

  return (
    <div className="flex flex-col px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-6 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-6 lg:pt-8 lg:pb-14">
      <h1 className="font-display text-[27px] text-ink">Community</h1>
      <p className="prose-story mt-3 text-[15px] text-body">
        Ask her anything about marriage, family or life. She reads every one and answers a few each
        week — never with your name on it.
      </p>

      <div className="mt-4">
        <AskForm />
      </div>

      <div className="sticky top-0 z-10 -mx-5 mt-5 bg-surface/95 px-5 pt-3 pb-3 backdrop-blur-sm lg:mx-0 lg:px-0">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[{ label: 'Feed' }, { label: 'Your questions', badge: mine.data?.length ?? 0 }]}
        />
      </div>

      {/* The panel makes the same entrance a screen does, so switching tabs
          reads as arriving somewhere rather than as the list redrawing. */}
      <Appear trigger={tab}>{tab === 'Feed' ? <Feed /> : <MyQuestions />}</Appear>
    </div>
  )
}

function Feed() {
  const feed = useCommunityFeed()
  const sentinel = useRef<HTMLDivElement | null>(null)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <Async query={feed}>
      {(data) => {
        const posts = data.pages.flatMap((page) => page.items)
        if (posts.length === 0) {
          return <p className="py-8 text-sm text-muted">Nothing here yet. Ask her something.</p>
        }
        return (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={sentinel} aria-hidden />
            {isFetchingNextPage && (
              <p className="py-4 text-center text-xs text-muted">Loading more…</p>
            )}
          </div>
        )
      }}
    </Async>
  )
}

function AskForm() {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const ask = useAskQuestion()
  const signIn = useSignInPrompt()

  const submit = () => {
    const trimmed = body.trim()
    if (trimmed.length < 5) return
    ask.mutate(trimmed, {
      onSuccess: () => {
        setBody('')
        setSent(true)
      },
      onError: (error) =>
        signIn.onError(error, 'Send your question to Amake Fe?', () => ask.mutate(trimmed)),
    })
  }

  if (sent) {
    return (
      <div className="rounded-card border border-line-strong bg-surface-raised p-4">
        <p className="prose-story text-[15px]">
          Your question is with her. Answers appear in the feed below — never your name.
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-2 text-xs text-accent">
          Ask another
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-strong bg-surface-raised p-4">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Type your question…"
        className="w-full resize-none bg-transparent font-prose text-[15px] leading-relaxed text-ink outline-none placeholder:text-[#a89684]"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Published anonymously</span>
        <Pill variant="ink" onClick={submit} disabled={body.trim().length < 5 || ask.isPending}>
          {ask.isPending ? 'Sending…' : 'Send question'}
        </Pill>
      </div>
      {signIn.node}
    </div>
  )
}

/** A reader's own questions, including the ones still waiting. */
function MyQuestions() {
  const mine = useMyQuestions()

  return (
    <Async query={mine}>
      {(list) =>
        list.length === 0 ? (
          <p className="py-8 text-sm text-muted">
            You have not asked anything yet. Whatever you send appears here.
          </p>
        ) : (
          <div>
            {list.map((question) => (
              <MyQuestion key={question.id} question={question} />
            ))}
          </div>
        )
      }
    </Async>
  )
}

function MyQuestion({ question }: { question: CommunityPost }) {
  const state = postState(question)

  return (
    <article className="flex flex-col gap-[7px] border-t border-line-soft py-[14px]">
      <h3 className="font-display text-[17px] leading-snug text-ink">{question.body}</h3>
      {question.answer ? (
        <>
          <p className="prose-story border-l-2 border-gold pl-3 text-[14.5px]">{question.answer}</p>
          <div className="text-xs text-muted">
            {state === 'published'
              ? 'Answered, and shared in the feed without your name.'
              : 'Answered for you. This one is not in the feed.'}
          </div>
        </>
      ) : (
        <div className="text-xs text-muted">Waiting for an answer</div>
      )}
    </article>
  )
}
