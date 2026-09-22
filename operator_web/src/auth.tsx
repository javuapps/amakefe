import { createContext, use, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { fetchAccount, type Account, type Session } from '@amakefe/core'
import { db } from './db'

/**
 * The operator console is a separate application because of who it is for.
 *
 * Supporters pay the platform; the platform settles Amake Fe the net after
 * commission. The party receiving the money must not be the party that records
 * the payout or chooses the account it goes to, so the two never share a build,
 * a session or a domain — the studio cannot reach these screens even signed in
 * as her, and nothing here is reachable without `usr_is_operator()`.
 *
 * The account must be `user_type = 'operator'` — ginni's `Expect`, applied
 * where Supabase allows it. Supabase Auth mints the session on a valid
 * credential whatever application it belongs to, so the check lands
 * immediately after sign-in rather than during it, and the person is signed
 * back out. The message names no other application: a wrong-surface credential
 * should not tell its holder where the account *does* work.
 *
 * The gate below is a courtesy to whoever is looking at the screen. The real
 * enforcement is RLS and the SECURITY DEFINER functions: `sup_settle` and
 * every `sup_` policy ask `usr_is_operator()`, which asks the type first — so
 * an editor holding a valid token reads nothing here.
 */

type AuthState = {
  session: Session | null
  account: Account | null
  isOperator: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = db.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setAccount(null)
        setLoading(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetchAccount(db)
      .then((next) => {
        if (cancelled) return
        setAccount(next)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setAccount(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const signOut = () => db.auth.signOut().then(() => undefined)

  return (
    <AuthContext value={{ session, account, isOperator: account?.userType === 'operator', loading, signOut }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthState {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth used outside AuthProvider')
  return context
}

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    // Deliberately vague: a precise message would tell an attacker which half
    // they got right.
    if (error) setError('That email and password do not match an account.')
  }

  const field =
    'w-full rounded-xl border border-surface-warm/25 bg-transparent px-4 py-3 text-sm text-surface-warm outline-none placeholder:text-[#8a7767] focus:border-gold'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="font-display text-lg text-surface-warm">Mindful Moments</div>
        <div className="text-[9.5px] uppercase tracking-[0.2em] text-[#9c8878]">
          Operator console
        </div>

        <h1 className="mt-8 font-display text-[26px] text-surface-warm">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#c9b6a4]">
          For the people who process payments and settle the creator. Accounts are created by an
          administrator.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={field}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className={field}
          />
          <button
            type="submit"
            disabled={busy || !email.includes('@') || password.length === 0}
            className="w-full rounded-full bg-gold py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {error && <p className="text-xs text-[#e0a43b]">{error}</p>}
        </div>
      </form>
    </div>
  )
}

/**
 * Signed in with a credential that does not belong here.
 *
 * It says nothing about what the account *is*. An editor who typed their
 * password into the console should learn that it does not work here, and
 * nothing more — naming the studio would turn a wrong guess into a map.
 */
export function NoAccess({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-[26px] text-surface-warm">No operator access</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#c9b6a4]">
          This account cannot open the operator console. Handling payouts is deliberately separate
          from writing and publishing, so it needs an account of its own.
        </p>
        <button type="button" onClick={onSignOut} className="mt-6 text-xs text-gold">
          Sign out
        </button>
      </div>
    </div>
  )
}
