import { currentReaderId, requireReaderId, type Db } from '../supabase'

/**
 * The reader's own corner of the app.
 *
 * Everything here is empty and harmless for someone who has not signed in —
 * they have no session, and Profile shows an invitation rather than an error.
 */

export type ReaderStats = {
  storiesRead: number
  saved: number
  topics: number
  /** Null until the reader has signed in. */
  memberSince: Date | null
  /**
   * The name they chose, shown beside anything they publish.
   *
   * Null until they pick one — an email address carries no name, and the
   * address itself is never shown to anyone.
   */
  displayName: string | null
}

export async function fetchReaderStats(db: Db): Promise<ReaderStats> {
  const userId = await currentReaderId(db)
  if (!userId) {
    return { storiesRead: 0, saved: 0, topics: 0, memberSince: null, displayName: null }
  }

  const [read, saved, topics, profile] = await Promise.all([
    db.from('usr_read_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('usr_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('usr_category_follows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('usr_profiles').select('display_name, created_at').eq('id', userId).maybeSingle(),
  ])

  return {
    storiesRead: read.count ?? 0,
    saved: saved.count ?? 0,
    topics: topics.count ?? 0,
    memberSince: profile.data?.created_at ? new Date(profile.data.created_at) : null,
    displayName: profile.data?.display_name ?? null,
  }
}

/**
 * The name a reader publishes under.
 *
 * Two characters minimum, forty maximum — the same bounds the database
 * enforces. Anything shorter is stored as null rather than rejected, so
 * clearing the field is a way of withdrawing the name, not an error.
 */
export async function setDisplayName(db: Db, displayName: string | null): Promise<void> {
  const userId = await requireReaderId(db)
  const trimmed = displayName?.trim() ?? ''
  const { error } = await db
    .from('usr_profiles')
    .update({ display_name: trimmed.length >= 2 ? trimmed.slice(0, 40) : null })
    .eq('id', userId)
  if (error) throw error
}

export async function fetchFollowedCategorySlugs(db: Db): Promise<Set<string>> {
  const userId = await currentReaderId(db)
  if (!userId) return new Set()

  const { data, error } = await db
    .from('usr_category_follows')
    .select('cnt_categories(slug)')
    .eq('user_id', userId)
  if (error) throw error
  return new Set(data.flatMap((row) => (row.cnt_categories ? [row.cnt_categories.slug] : [])))
}

/** Returns the new followed state. */
export async function toggleCategoryFollow(db: Db, categorySlug: string): Promise<boolean> {
  const userId = await requireReaderId(db)

  const { data: category, error: categoryError } = await db
    .from('cnt_categories')
    .select('id')
    .eq('slug', categorySlug)
    .single()
  if (categoryError) throw categoryError

  const { data: existing } = await db
    .from('usr_category_follows')
    .select('category_id')
    .eq('user_id', userId)
    .eq('category_id', category.id)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('usr_category_follows')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', category.id)
    if (error) throw error
    return false
  }

  const { error } = await db
    .from('usr_category_follows')
    .insert({ user_id: userId, category_id: category.id })
  if (error) throw error
  return true
}
