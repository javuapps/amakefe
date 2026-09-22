import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { signInWithFacebook, signOutReader, type Session } from '@amakefe/core'
import { db } from './db'

/**
 * Who the reader is.
 *
 * Reading needs no account: the app opens straight onto Home and every
 * published story is readable by the `anon` role. An identity appears only when
 * a reader does something that has to be remembered — save, react, vote,
 * answer, ask — and it is their Facebook account, because that is where this
 * audience already is and a comment should carry a name the way it does on the
 * Page.
 *
 * Signing in is never a wall. It is offered at the moment of the gesture, and
 * the gesture is replayed afterwards (see `pendingIntent`), so the reader is
 * never sent back to the beginning of what they were doing.
 */

type AuthState = {
  session: Session | null
  loading: boolean
  signIn: (intent?: Intent) => Promise<void>
  signOut: () => Promise<void>
}

/**
 * The action a reader was taking when they were asked to sign in.
 *
 * Facebook takes over the whole page, so anything held only in component state
 * is gone by the time they come back. Without this a reader taps ♥, disappears
 * to Facebook, returns to the story — and nothing has happened, which reads as
 * the app having ignored them.
 */
export type Intent =
  | { kind: 'save'; storyId: string }
  /** The slug travels too: it is what the story query is cached under. */
  | { kind: 'react'; storyId: string; slug: string }
  | { kind: 'follow'; categorySlug: string }
  | { kind: 'vote'; pollId: string; optionId: string }

const INTENT_KEY = 'pending-intent'

export function rememberIntent(intent: Intent) {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent))
  } catch {
    // A private window with storage blocked: the sign-in still works, the
    // reader just repeats the tap. Better than refusing to sign them in.
  }
}

/** Reads the pending intent without clearing it. */
export function peekIntent(): Intent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY)
    return raw ? (JSON.parse(raw) as Intent) : null
  } catch {
    return null
  }
}

/** Reads the pending intent and clears it — it must only ever be replayed once. */
export function takeIntent(): Intent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(INTENT_KEY)
    return JSON.parse(raw) as Intent
  } catch {
    return null
  }
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

  const signIn = useCallback(async (intent?: Intent) => {
    if (intent) rememberIntent(intent)
    // Back to the page they were reading, not to Home having lost their place.
    await signInWithFacebook(db, window.location.href)
  }, [])

  const signOut = useCallback(async () => {
    await signOutReader(db)
  }, [])

  return <AuthContext value={{ session, loading, signIn, signOut }}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const state = use(AuthContext)
  if (!state) throw new Error('useAuth outside AuthProvider')
  return state
}
