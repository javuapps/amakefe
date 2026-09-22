import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchAccount, signOutReader, type Session } from '@amakefe/core'
import { db } from './db'

/**
 * Who the reader is.
 *
 * Reading needs no account: the app opens straight onto Home and every
 * published story is readable by the `anon` role. An identity appears only when
 * a reader does something that has to be remembered — save, react, vote,
 * answer, ask — and it is an email address confirmed with a six-digit code.
 *
 * Signing in never leaves the page. That is worth more than it sounds: the
 * reader stays in the story they were reading, and the action that prompted the
 * sign-in finishes the moment the code checks out, so there is no gesture to
 * remember across a redirect and nothing to replay afterwards.
 *
 * **A session here must belong to a reader.** Nothing stops an editor asking
 * this app for a code — they have an email address like anyone — but a studio
 * or console account has no `usr_profiles` row, so the first save or reaction
 * would fail on a foreign key with nothing to show for it. It is refused at the
 * door instead, quietly: the session is dropped and reading carries on, because
 * reading never needed an account in the first place.
 */

type AuthState = {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = db.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  // The backstop, for a session that already existed — someone who signed in
  // here before their account was made a studio one, say. It drops the session
  // and says nothing, because there is nobody to say it to: reading carries on
  // exactly as it did. The sheet handles the case where someone is watching.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetchAccount(db).then((account) => {
      if (cancelled || !account || account.userType === 'reader') return
      void signOutReader(db)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  const signOut = useCallback(async () => {
    await signOutReader(db)
  }, [])

  return <AuthContext value={{ session, loading, signOut }}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const state = use(AuthContext)
  if (!state) throw new Error('useAuth outside AuthProvider')
  return state
}
