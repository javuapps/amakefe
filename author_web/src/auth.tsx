import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { fetchAccount, type Account, type Session } from '@amakefe/core'
import { db } from './db'
import { clearAllDrafts } from './draftStore'
import { Mark } from './components/Mark'

/**
 * The studio is the one surface with real accounts.
 *
 * Readers stay anonymous; editors do not. Sign-in is email and password. An
 * emailed one-time code would be the stronger choice for accounts that can
 * publish to 200,000 people, and is worth revisiting once SMTP is configured —
 * until then it cannot deliver anything, so a password is what actually works.
 *
 * Accounts are created by an administrator; there is no sign-up here.
 *
 * Being signed in is not enough, and neither is a role. The account must be
 * `user_type = 'editorial'` — ginni's `Expect`, applied where Supabase allows
 * it. Supabase Auth mints a session on any valid credential, so the surface
 * check lands immediately after sign-in rather than during it, and an operator
 * who typed their password here is signed back out with a message that does
 * not name the console.
 *
 * The gate below is a courtesy to the person looking at the screen; the real
 * enforcement is in RLS and in the SECURITY DEFINER functions, which now ask
 * the type before the role — which is why a stolen token still reads nothing.
 */

type AuthState = {
  session: Session | null
  account: Account | null
  isEditorial: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [isEditorial, setIsEditorial] = useState(false)
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
        setIsEditorial(false)
        setLoading(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    // Both questions, in one round trip's worth of latency: which application
    // the account belongs to, and what it may do inside it. `usr_is_editorial`
    // now answers both, but the account is wanted anyway — for the name.
    Promise.all([fetchAccount(db), db.rpc('usr_is_editorial')])
      .then(([next, role]) => {
        if (cancelled) return
        setAccount(next)
        setIsEditorial(next?.userType === 'editorial' && role.data === true)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setAccount(null)
        setIsEditorial(false)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const signOut = async () => {
    // The local draft buffer is the one thing the studio keeps on disk. It does
    // not outlive the session on a shared machine.
    await clearAllDrafts()
    await db.auth.signOut()
  }

  return (
    <AuthContext value={{ session, account, isEditorial, loading, signOut }}>{children}</AuthContext>
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await db.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    // Deliberately vague: a precise message would tell an attacker which half
    // they got right.
    if (error) setError('That email and password do not match an account.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <Mark size={56} />
          <div>
            <div className="font-display text-lg text-surface-warm">Mindful Moments</div>
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-[#9c8878]">
              Creator studio
            </div>
          </div>
        </div>

        <h1 className="mt-8 font-display text-[26px] text-surface-warm">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#c9b6a4]">
          Accounts are created by an administrator.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-surface-warm/25 bg-transparent px-4 py-3 text-sm text-surface-warm outline-none placeholder:text-[#8a7767] focus:border-gold"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-surface-warm/25 bg-transparent px-4 py-3 text-sm text-surface-warm outline-none placeholder:text-[#8a7767] focus:border-gold"
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

/** Signed in, but without an editorial role. */
export function NoAccess({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-[26px] text-surface-warm">No studio access</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#c9b6a4]">
          This account cannot open the studio. An administrator provisions studio accounts, and an
          account made for another part of the platform is not one of them.
        </p>
        <button type="button" onClick={onSignOut} className="mt-6 text-xs text-gold">
          Sign out
        </button>
      </div>
    </div>
  )
}
