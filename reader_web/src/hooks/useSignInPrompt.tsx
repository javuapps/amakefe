import { useCallback, useState, type ReactNode } from 'react'
import { isNotSignedIn } from '@amakefe/core'
import { SignInSheet } from '../components/SignInSheet'
import type { Intent } from '../auth'

/**
 * What happens when a reader taps something that needs an account.
 *
 * Every one of these actions used to call `.mutate()` with no error branch, so
 * a tap on Save or ♥ simply did nothing and said nothing — which reads as a
 * broken button, not as a request to sign in. Each now routes its failure here:
 * a missing account opens the sheet with the reason and the gesture to replay,
 * and anything else says so plainly instead of disappearing.
 */
export function useSignInPrompt(): {
  onError: (error: unknown, reason: string, intent?: Intent) => void
  node: ReactNode
} {
  const [ask, setAsk] = useState<{ reason: string; intent?: Intent } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const onError = useCallback((error: unknown, reason: string, intent?: Intent) => {
    if (isNotSignedIn(error)) {
      setAsk({ reason, intent })
      return
    }
    setFailed('That did not work. Please try again in a moment.')
    setTimeout(() => setFailed(null), 4000)
  }, [])

  const node = (
    <>
      {ask && (
        <SignInSheet reason={ask.reason} intent={ask.intent} onClose={() => setAsk(null)} />
      )}
      {failed && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-[480px] rounded-full bg-ink px-4 py-2 text-center text-xs text-surface-warm"
        >
          {failed}
        </p>
      )}
    </>
  )

  return { onError, node }
}
