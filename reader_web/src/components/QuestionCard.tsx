import { useState } from 'react'
import { formatCount, type QuestionCard as Question } from '@amakefe/core'
import { Card, Pill } from './primitives'
import { useAuth } from '../auth'
import { usePostAnswer, useReaderStats } from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

export function QuestionCard({ question }: { question: Question }) {
  const [answering, setAnswering] = useState(false)
  const [body, setBody] = useState('')
  const postAnswer = usePostAnswer()
  const signIn = useSignInPrompt()
  const { session } = useAuth()
  const stats = useReaderStats()

  const submit = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    postAnswer.mutate(
      { questionId: question.id, body: trimmed },
      {
        onSuccess: () => {
          setBody('')
          setAnswering(false)
        },
        onError: (error) =>
          signIn.onError(error, 'Post your answer?', () =>
            postAnswer.mutate({ questionId: question.id, body: trimmed }),
          ),
      },
    )
  }

  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-display text-[17px] leading-snug text-ink">{question.body}</h3>
      <div className="text-xs text-muted">
        {question.answerCount === 0
          ? 'No answers yet'
          : `${formatCount(question.answerCount)} ${question.answerCount === 1 ? 'answer' : 'answers'}`}
      </div>

      {question.latestAnswer && (
        <blockquote className="border-l-2 border-gold pl-3">
          <p className="prose-story text-sm">{question.latestAnswer}</p>
          {question.latestAnswerAuthor && (
            <cite className="mt-1 block text-xs not-italic text-muted">
              {question.latestAnswerAuthor}
            </cite>
          )}
        </blockquote>
      )}

      {answering ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Share what you have learned…"
            className="w-full resize-none rounded-tile border border-line-strong bg-surface-raised p-3 font-prose text-[15px] leading-relaxed text-ink outline-none placeholder:text-subtle focus:border-accent"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {session && stats.data?.displayName
                ? `Posting as ${stats.data.displayName}`
                : 'Posted under the name you choose'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAnswering(false)}
                className="text-xs text-muted"
              >
                Cancel
              </button>
              <Pill variant="ink" onClick={submit} disabled={!body.trim() || postAnswer.isPending}>
                {postAnswer.isPending ? 'Sending…' : 'Post answer'}
              </Pill>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAnswering(true)}
          className="self-start text-xs text-accent"
        >
          Add your answer
        </button>
      )}
      {signIn.node}
    </Card>
  )
}
