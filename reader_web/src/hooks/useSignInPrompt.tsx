import { useCallback, useRef, useState, type ReactNode } from 'react'
import { isNotSignedIn } from '@amakefe/core'
import { SignInSheet } from '../components/SignInSheet'

/**
 * What happens when a reader taps something that needs an account.
 *
 * Every one of these actions used to call `.mutate()` with no error branch, so
 * a tap on Save or ♥ simply did nothing and said nothing — which reads as a
 * broken button, not as a request to sign in. Each now routes its failure here:
 * a missing account opens the sheet, and anything else says so plainly instead
 * of disappearing.
 *
 * The failed call is handed over with it and run again once the code checks
 * out. Signing in stays on the page, so this is a retry rather than anything
 * that has to survive a redirect.
 */
export function useSignInPrompt(): {
  onError: (error: unknown, reason: string, retry?: () => void) => void
  node: ReactNode
} {
  const [reason, setReason] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const retry = useRef<(() => void) | null>(null)

  const onError = useCallback((error: unknown, why: string, again?: () => void) => {
    if (isNotSignedIn(error)) {
      retry.current = again ?? null
      setReason(why)
      return
    }
    setFailed('That did not work. Please try again in a moment.')
    setTimeout(() => setFailed(null), 4000)
  }, [])

  const node = (
    <>
      {reason && (
        <SignInSheet
          reason={reason}
          onSignedIn={() => retry.current?.()}
          onClose={() => {
            retry.current = null
            setReason(null)
          }}
        />
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
