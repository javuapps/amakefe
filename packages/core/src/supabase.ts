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
 * vote), and it is their Facebook account: a durable auth.uid() carrying their
 * name and picture, so a comment can be published under it the way it would be
 * on the Page itself.
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
 * Sends the reader to Facebook and back.
 *
 * `redirectTo` is the page they were on, so they return to the story they were
 * reading rather than to Home having lost their place.
 */
export async function signInWithFacebook(db: Db, redirectTo: string): Promise<void> {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo },
  })
  if (error) throw error
}

/**
 * Attaches Facebook to a session that already exists, keeping the same uid — so
 * anything already saved, read or reacted to survives the upgrade.
 */
export async function linkFacebook(db: Db, redirectTo: string): Promise<void> {
  const { error } = await db.auth.linkIdentity({
    provider: 'facebook',
    options: { redirectTo },
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
