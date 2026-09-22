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
  /** Their Facebook name, as it appears beside anything they publish. */
  displayName: string | null
  /** Their Facebook picture. */
  avatarUrl: string | null
}

export async function fetchReaderStats(db: Db): Promise<ReaderStats> {
  const userId = await currentReaderId(db)
  if (!userId) {
    return {
      storiesRead: 0,
      saved: 0,
      topics: 0,
      memberSince: null,
      displayName: null,
      avatarUrl: null,
    }
  }

  const [read, saved, topics, profile] = await Promise.all([
    db.from('usr_read_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('usr_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('usr_category_follows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('usr_profiles')
      .select('display_name, avatar_url, created_at')
      .eq('id', userId)
      .maybeSingle(),
  ])

  return {
    storiesRead: read.count ?? 0,
    saved: saved.count ?? 0,
    topics: topics.count ?? 0,
    memberSince: profile.data?.created_at ? new Date(profile.data.created_at) : null,
    displayName: profile.data?.display_name ?? null,
    avatarUrl: profile.data?.avatar_url ?? null,
  }
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

/** How many people support the community — the only figure sup_ exposes publicly. */
export async function fetchSupporterCount(db: Db): Promise<number> {
  const { data, error } = await db.rpc('sup_supporter_count')
  if (error) throw error
  return data ?? 0
}
