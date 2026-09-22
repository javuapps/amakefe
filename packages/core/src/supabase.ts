import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Re-exported so the apps never need supabase-js as a direct dependency.
export type { Session, User } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type Db = SupabaseClient<Database>

/**
 * The publishable key is public by design — every rule that matters is enforced
 * by RLS in the database, not by hiding this string. Apps pass their own values
 * from Vite env so a different environment needs no code change.
 */
export function createDb(url: string, publishableKey: string): Db {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}

/**
 * Raised when an action needs a reader who is signed in and nobody is.
 *
 * This is a value, not a failure: the app catches it and offers the Facebook
 * button, so the reader signs in and the action goes through. It must be thrown
 * rather than handled here, because signing in leaves the page — a query layer
 * that redirected would tear down the screen mid-gesture.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to do that.')
    this.name = 'NotSignedInError'
  }
}

export function isNotSignedIn(error: unknown): error is NotSignedInError {
  return error instanceof NotSignedInError
}

/**
 * The reader's identity.
 *
 * Reading needs no account at all — published content is readable by the `anon`
 * role, and the app opens straight onto Home. An identity appears the first time
 * a reader does something that has to be remembered (save, react, comment,
 * vote), and it is an email address they confirm with a code.
 *
 * An email carries no name, so the reader chooses one. It is what appears
 * beside anything they publish; the address itself is never shown to anyone.
 *
 * Submitting is never anonymous. Where anonymity is required it is applied at
 * *publication* — a question to Amake Fe goes out unattributed, and the policy
 * on `usr_profiles` is what enforces that, not this function.
 */
export async function requireReaderId(db: Db): Promise<string> {
  const { data } = await db.auth.getSession()
  if (!data.session) throw new NotSignedInError()
  return data.session.user.id
}

/** The current reader id, or null when they have not signed in. Never signs in. */
export async function currentReaderId(db: Db): Promise<string | null> {
  const { data } = await db.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Sends a six-digit code to an email address.
 *
 * `shouldCreateUser` is on: there is no separate sign-up, and a reader who has
 * never been here before is not a different case from one who has.
 *
 * Nothing about this leaves the page, which is the point — the reader stays in
 * the story they were reading, and the action that prompted the sign-in can be
 * finished the moment the code checks out.
 */
export async function sendEmailCode(db: Db, email: string): Promise<void> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** Exchanges the emailed code for a session. */
export async function verifyEmailCode(db: Db, email: string, code: string): Promise<void> {
  const { error } = await db.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  })
  if (error) throw error
}

export async function signOutReader(db: Db): Promise<void> {
  const { error } = await db.auth.signOut()
  if (error) throw error
}

/**
 * Removes the signed-in reader's account and everything attached to it.
 *
 * The server decides what that means — see the `delete-account` function — and
 * the session is cleared afterwards so the app cannot keep acting as an account
 * that no longer exists.
 */
export async function deleteReaderAccount(db: Db): Promise<void> {
  const { data, error } = await db.functions.invoke<{ deleted?: boolean; error?: string }>(
    'delete-account',
    { body: {} },
  )
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  await db.auth.signOut()
}
