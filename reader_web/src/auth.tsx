import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { signOutReader, type Session } from '@amakefe/core'
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
