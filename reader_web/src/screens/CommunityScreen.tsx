import { formatRelative } from '@amakefe/core'
import { Async, Card } from '../components/primitives'
import { Mark } from '../components/Mark'
import { PollCard } from '../components/PollCard'
import { QuestionCard } from '../components/QuestionCard'
import { useActivePoll, useCreatorPost, useQuestions } from '../hooks/queries'

export function CommunityScreen() {
  const creatorPost = useCreatorPost()
  const questions = useQuestions()
  const poll = useActivePoll()

  return (
    <div className="flex flex-col gap-4 px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-6">
      <h1 className="font-display text-[27px] text-ink">Community</h1>

      <Async query={creatorPost} loading={<div className="h-32 animate-pulse rounded-card bg-surface-tint" />}>
        {(post) =>
          post && (
            <Card className="flex flex-col gap-[10px] bg-surface-raised">
              <div className="flex items-center gap-[10px]">
                <Mark size={32} />
                <div>
                  <div className="text-sm font-semibold text-ink">Amake Fe</div>
                  <div className="text-[11px] text-muted">
                    Creator post · {formatRelative(post.publishedAt)}
                  </div>
                </div>
              </div>
              <p className="prose-story text-[15px]">{post.body}</p>
            </Card>
          )
        }
      </Async>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[19px] text-ink">Questions this week</h2>
        <Async query={questions}>
          {(list) =>
            list.length === 0 ? (
              <p className="text-sm text-muted">No questions yet this week.</p>
            ) : (
              <>
                {list.map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
              </>
            )
          }
        </Async>
      </section>

      {poll.data && <PollCard poll={poll.data} />}
    </div>
  )
}
