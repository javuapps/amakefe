import { useState } from 'react'
import { formatRelative, postState, type CommunityPost, type PostKind } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { Tabs } from '../components/Tabs'
import { Menu } from '../components/Menu'
import { useConfirm } from '../components/ConfirmDialog'
import {
  useAnswerQuestion,
  useAskerNames,
  useCreateNotice,
  useCreatePoll,
  useDeletePost,
  usePosts,
  useSetPostPublished,
} from '../hooks/queries'

/**
 * The community, from her side.
 *
 * One timeline for readers; three jobs for her, and they are different enough
 * to be different screens. Answering a question is writing; a poll is a thing
 * you build once; a notice is a sentence you publish. `/community/:kind` is one
 * component because the frame — publish, unpublish, delete, when it went out —
 * is identical, and only the middle differs.
 */
export function CommunityScreen({ kind }: { kind: PostKind }) {
  const posts = usePosts(kind)

  return (
    <Async query={posts}>
      {(all) => (
        <div className="flex flex-col gap-5">
          {kind === 'notice' && <NewNotice />}
          {kind === 'poll' && <NewPoll />}
          {kind === 'question' ? <Questions posts={all} /> : <Simple posts={all} kind={kind} />}
        </div>
      )}
    </Async>
  )
}

/** Questions wait, get answered, then go out — so they get the three tabs. */
function Questions({ posts }: { posts: CommunityPost[] }) {
  const [tab, setTab] = useState<'Waiting' | 'Answered' | 'Published'>('Waiting')

  const byState = {
    Waiting: posts.filter((p) => postState(p) === 'waiting'),
    Answered: posts.filter((p) => postState(p) === 'answered'),
    Published: posts.filter((p) => postState(p) === 'published'),
  }
  const shown = byState[tab]
  const askers = useAskerNames(shown.map((p) => p.id))

  return (
    <>
      <Tabs
        value={tab}
        onChange={(label) => setTab(label as typeof tab)}
        items={(['Waiting', 'Answered', 'Published'] as const).map((name) => ({
          label: name,
          badge:
            byState[name].length > 0 ? (
              <span className={name === 'Waiting' ? 'text-accent' : 'text-muted'}>
                {byState[name].length}
              </span>
            ) : undefined,
        }))}
      />

      {shown.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">
            {tab === 'Waiting'
              ? 'Nothing waiting. Questions appear here as readers send them.'
              : tab === 'Answered'
                ? 'Nothing answered and held back.'
                : 'Nothing published yet.'}
          </p>
        </Panel>
      ) : (
        shown.map((post) => (
          <Question key={post.id} post={post} asker={askers.data?.get(post.id) ?? null} />
        ))
      )}
    </>
  )
}

function Question({ post, asker }: { post: CommunityPost; asker: string | null }) {
  const answer = useAnswerQuestion()
  const publish = useSetPostPublished()
  const remove = useDeletePost()
  const confirm = useConfirm()

  const [draft, setDraft] = useState(post.answer ?? '')
  const state = postState(post)
  const busy = answer.isPending || publish.isPending || remove.isPending
  const changed = draft.trim() !== (post.answer ?? '')

  return (
    <Panel>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[11px] text-muted">
            {/* Null for one she took down herself, off a call or WhatsApp. */}
            {asker ?? 'No name given'} · asked {formatRelative(post.createdAt)}
          </div>
          <p className="prose-story mt-2 max-w-prose text-[15.5px]">{post.body}</p>
        </div>
        <PostMenu post={post} confirm={confirm} publish={publish} remove={remove} />
      </div>

      <div className="mt-4 border-t border-line-soft pt-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder="Her answer…"
          className="auto-grow w-full resize-y rounded-lg border border-line-card bg-surface p-3 font-prose text-[15px] leading-relaxed text-ink outline-none focus:border-line-strong"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!changed || busy}
            onClick={() => answer.mutate({ postId: post.id, answer: draft })}
            className="rounded-full border border-line-strong px-5 py-2 text-xs font-semibold text-body disabled:opacity-40"
          >
            {answer.isPending ? 'Saving…' : 'Save answer'}
          </button>

          {state !== 'published' && (
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={async () => {
                // Saving first means Publish sends what is on screen, not what
                // was last written to the row.
                if (changed) await answer.mutateAsync({ postId: post.id, answer: draft })
                publish.mutate({ postId: post.id, publish: true })
              }}
              className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-[#fff6ea] disabled:opacity-40"
            >
              Save &amp; publish
            </button>
          )}

          <span className="text-xs text-muted">
            {state === 'published'
              ? 'On the timeline.'
              : state === 'answered'
                ? 'Answered, not published.'
                : 'Not answered yet.'}
          </span>
        </div>
      </div>
    </Panel>
  )
}

/** Polls and notices have no waiting state: she writes them, then sends them. */
function Simple({ posts, kind }: { posts: CommunityPost[]; kind: PostKind }) {
  const publish = useSetPostPublished()
  const remove = useDeletePost()
  const confirm = useConfirm()

  if (posts.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-muted">
          {kind === 'poll' ? 'No polls yet.' : 'No notices yet.'}
        </p>
      </Panel>
    )
  }

  return (
    <>
      {posts.map((post) => (
        <Panel key={post.id}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[11px] text-muted">
                {post.publishedAt
                  ? `On the timeline since ${formatRelative(post.publishedAt)}`
                  : 'Not published'}
                {kind === 'poll' && ` · ${post.voteCount} ${post.voteCount === 1 ? 'vote' : 'votes'}`}
                {` · ${post.likeCount} ♥ · ${post.commentCount} ❝`}
              </div>
              <p className="prose-story mt-2 max-w-prose text-[15.5px]">{post.body}</p>
            </div>
            <PostMenu post={post} confirm={confirm} publish={publish} remove={remove} />
          </div>
        </Panel>
      ))}
    </>
  )
}

function PostMenu({
  post,
  confirm,
  publish,
  remove,
}: {
  post: CommunityPost
  confirm: ReturnType<typeof useConfirm>
  publish: ReturnType<typeof useSetPostPublished>
  remove: ReturnType<typeof useDeletePost>
}) {
  return (
    <Menu
      items={[
        post.publishedAt
          ? {
              label: 'Take it down',
              onSelect: () => publish.mutate({ postId: post.id, publish: false }),
            }
          : {
              label: 'Publish',
              onSelect: () => publish.mutate({ postId: post.id, publish: true }),
              disabled: post.kind === 'question' && !post.answer,
              hint:
                post.kind === 'question' && !post.answer ? 'Write an answer first' : undefined,
            },
        {
          label: 'Delete',
          tone: 'danger' as const,
          onSelect: async () => {
            const ok = await confirm({
              title: 'Delete this?',
              body: 'It disappears from the timeline along with its comments. This cannot be undone.',
              confirmLabel: 'Delete',
              tone: 'danger',
            })
            if (ok) remove.mutate(post.id)
          },
        },
      ]}
    />
  )
}

function NewNotice() {
  const create = useCreateNotice()
  const [body, setBody] = useState('')

  return (
    <Panel title="New notice">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="Something to tell the community…"
        className="auto-grow w-full resize-y rounded-lg border border-line-card bg-surface p-3 font-prose text-[15px] leading-relaxed text-ink outline-none focus:border-line-strong"
      />
      <button
        type="button"
        disabled={!body.trim() || create.isPending}
        onClick={() => create.mutate(body.trim(), { onSuccess: () => setBody('') })}
        className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
      >
        {create.isPending ? 'Saving…' : 'Save as draft'}
      </button>
      <p className="mt-2 text-xs text-muted">
        Saved unpublished, so you can read it again before anyone else does.
      </p>
    </Panel>
  )
}

function NewPoll() {
  const create = useCreatePoll()
  const [question, setQuestion] = useState('')
  const [labels, setLabels] = useState(['', ''])

  const filled = labels.map((l) => l.trim()).filter(Boolean)
  const ready = question.trim().length > 0 && filled.length >= 2

  return (
    <Panel title="New poll">
      <input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="The question"
        className="w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
      />
      <div className="mt-3 flex flex-col gap-2">
        {labels.map((label, index) => (
          <input
            key={index}
            value={label}
            onChange={(event) =>
              setLabels((all) => all.map((l, i) => (i === index ? event.target.value : l)))
            }
            placeholder={`Answer ${index + 1}`}
            className="w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setLabels((all) => [...all, ''])}
          className="text-xs text-accent"
        >
          + Another answer
        </button>
        <button
          type="button"
          disabled={!ready || create.isPending}
          onClick={() =>
            create.mutate(
              { question: question.trim(), labels: filled },
              {
                onSuccess: () => {
                  setQuestion('')
                  setLabels(['', ''])
                },
              },
            )
          }
          className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
        >
          {create.isPending ? 'Saving…' : 'Save as draft'}
        </button>
        <span className="text-xs text-muted">Two answers at least.</span>
      </div>
    </Panel>
  )
}
