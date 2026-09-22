import type { Db } from '../supabase'
import type { Enums } from '../database.types'

/**
 * Which application this session belongs to, and who it belongs to.
 *
 * Adopted from ginni, where every sign-in surface passes the `user_type` it
 * serves and anyone else is refused "even with the right password". Supabase
 * Auth mints the session before this schema is consulted, so the check cannot
 * happen during sign-in — it happens immediately after, and again behind every
 * row, in the policies. This is the first half; RLS is the half that counts.
 */
export type UserType = Enums<'sec_user_type'>

export type Account = {
  id: string
  userType: UserType
  /** From the profile table for this type, where one has been recorded. */
  name: string | null
  email: string | null
}

/**
 * The signed-in account, or null when there is no session.
 *
 * Throws nothing for a suspended account or one with no `sec_users` row: both
 * come back as `null`, which every caller already handles as "not signed in".
 * A distinct error would tell the holder something about an account they have
 * just been refused.
 */
export async function fetchAccount(db: Db): Promise<Account | null> {
  const { data: auth } = await db.auth.getUser()
  const user = auth?.user
  if (!user) return null

  const { data, error } = await db
    .from('sec_users')
    .select('id, user_type, full_name, edt_editors(first_name, last_name), opr_operators(first_name, last_name)')
    .eq('id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  // Exactly one of the two profile joins can be present — a trigger enforces
  // that a profile matches its user's type — so this is a lookup, not a guess.
  const profile = data.edt_editors ?? data.opr_operators
  return {
    id: data.id,
    userType: data.user_type,
    name: profile ? `${profile.first_name} ${profile.last_name}` : data.full_name,
    email: user.email ?? null,
  }
}

/** An editor's own name, as the studio's account panel edits it. */
export type EditorName = { firstName: string; lastName: string }

export async function fetchEditorName(db: Db): Promise<EditorName | null> {
  const { data: auth } = await db.auth.getUser()
  if (!auth?.user) return null

  const { data, error } = await db
    .from('edt_editors')
    .select('first_name, last_name')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data ? { firstName: data.first_name, lastName: data.last_name } : null
}

/**
 * Records it.
 *
 * Through an RPC rather than a table write, because the name lives in two
 * places — `sec_users.full_name`, which every surface reads without joining,
 * and the profile's two halves, which a form edits. One statement moves both,
 * so they cannot drift.
 */
export async function saveEditorName(db: Db, name: EditorName): Promise<void> {
  const { error } = await db.rpc('edt_save_name', {
    p_first_name: name.firstName,
    p_last_name: name.lastName,
  })
  if (error) throw error
}
