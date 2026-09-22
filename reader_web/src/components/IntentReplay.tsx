import { useEffect, useRef } from 'react'
import { peekIntent, takeIntent, useAuth } from '../auth'
import {
  useCastVote,
  useToggleCategoryFollow,
  useToggleReaction,
  useToggleSaved,
} from '../hooks/queries'

/**
 * Finishes the gesture that sent the reader to Facebook.
 *
 * Signing in navigates away from the app entirely, so the tap that prompted it
 * is gone by the time they return. This picks the intent back up and performs
 * it once, so agreeing to sign in *does the thing* — rather than returning the
 * reader to a story where their ♥ never registered and asking them to notice.
 *
 * It renders nothing. It is mounted in the shell rather than in a screen
 * because the reader can land back on any route.
 */
export function IntentReplay() {
  const { session, loading } = useAuth()
  const save = useToggleSaved()
  const follow = useToggleCategoryFollow()
  const vote = useCastVote()
  const done = useRef(false)

  // The reaction hook keys its invalidation on the story's slug, which the
  // intent carried across the round trip for exactly this reason.
  const pending = useRef(peekIntent())
  const react = useToggleReaction(pending.current?.kind === 'react' ? pending.current.slug : '')

  useEffect(() => {
    if (loading || !session || done.current) return
    const intent = takeIntent()
    if (!intent) return
    // Once only, whatever happens next: a replay that failed is not worth
    // repeating on every render, and the reader can simply tap again.
    done.current = true

    switch (intent.kind) {
      case 'save':
        save.mutate(intent.storyId)
        break
      case 'react':
        react.mutate(intent.storyId)
        break
      case 'follow':
        follow.mutate(intent.categorySlug)
        break
      case 'vote':
        vote.mutate({ pollId: intent.pollId, optionId: intent.optionId })
        break
    }
  }, [loading, session, save, react, follow, vote])

  return null
}
