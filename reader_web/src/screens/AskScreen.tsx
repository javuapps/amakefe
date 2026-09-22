import { useState } from 'react'
import { formatRelative } from '@amakefe/core'
import { Async, Pill } from '../components/primitives'
import { useAnsweredQuestions, useAskQuestion } from '../hooks/queries'
import { useSignInPrompt } from '../hooks/useSignInPrompt'

export function AskScreen() {
  const answered = useAnsweredQuestions()

  return (
    <div className="flex flex-col gap-4 px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-6">
      <h1 className="font-display text-[27px] text-ink">Ask Her</h1>
      <p className="prose-story text-[15px] text-body">
        Ask a question about marriage, family or life. She reads every one and answers a few each
        week. Published questions never carry your name.
      </p>

      <AskForm />

      <h2 className="mt-1 font-display text-[19px] text-ink">Recently answered</h2>
      <Async query={answered}>
        {(list) =>
          list.length === 0 ? (
            <p className="text-sm text-muted">No answered questions yet.</p>
          ) : (
            <div>
              {list.map((item) => (
                <article key={item.id} className="flex flex-col gap-[7px] border-t border-line-soft py-[14px]">
                  <h3 className="font-display text-[17px] leading-snug text-ink">{item.question}</h3>
                  <p className="prose-story text-[14.5px]">{item.answer}</p>
                  <div className="text-xs text-muted">
                    Answered {formatRelative(item.answeredAt)}
                  </div>
                </article>
              ))}
            </div>
          )
        }
      </Async>
    </div>
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
          Your question is with her. She answers a few each week, and published answers appear
          below — never your name.
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
        rows={4}
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
