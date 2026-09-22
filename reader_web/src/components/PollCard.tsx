import { formatCount, optionShare, type Poll } from '@amakefe/core'
import { Card, SectionLabel } from './primitives'
import { useCastVote } from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

/**
 * Results are shown before and after voting, as the prototype does. A reader who
 * has not voted still sees where the community stands — that is the point of the
 * card, and hiding it would make the poll feel like a quiz.
 */
export function PollCard({ poll }: { poll: Poll }) {
  const vote = useCastVote()
  const signIn = useSignInPrompt()

  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>
        Poll{poll.totalVotes > 0 && ` · ${formatCount(poll.totalVotes)} votes`}
      </SectionLabel>
      <h3 className="font-display text-[19px] leading-snug text-ink">{poll.question}</h3>
      <div className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const share = optionShare(poll, option)
          const mine = poll.myOptionId === option.optionId
          return (
            <button
              key={option.optionId}
              type="button"
              disabled={vote.isPending}
              onClick={() =>
                vote.mutate(
                  { pollId: poll.id, optionId: option.optionId },
                  {
                    onError: (error) =>
                      signIn.onError(error, 'Add your vote?', () =>
                        vote.mutate({ pollId: poll.id, optionId: option.optionId }),
                      ),
                  },
                )
              }
              className={`relative flex items-center justify-between overflow-hidden rounded-tile border px-[14px] py-[11px] text-sm ${
                mine ? 'border-accent' : 'border-line-card'
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-surface-warm transition-[width] duration-300"
                style={{ width: `${Math.round(share * 100)}%` }}
                aria-hidden
              />
              <span className={`relative font-medium ${mine ? 'text-accent' : 'text-ink'}`}>
                {option.label}
              </span>
              <span className="relative text-muted">{Math.round(share * 100)}%</span>
            </button>
          )
        })}
      </div>
      {signIn.node}
    </Card>
  )
}
