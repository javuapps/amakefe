import { currentReaderId, requireReaderId, type Db } from '../supabase'
import { toStoryCard, type StoryCard } from '../models/story'

/**
 * Saves, reactions and reading position.
 *
 * Reads return empty for a reader who has never acted — they have no session and
 * that is fine. Writes call requireReaderId first, which is the only moment an
 * anonymous session is created, and it happens without interrupting anyone.
 */

export async function fetchSavedIds(db: Db): Promise<Set<string>> {
  const userId = await currentReaderId(db)
  if (!userId) return new Set()

  const { data, error } = await db.from('usr_bookmarks').select('story_id').eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((row) => row.story_id))
}

/** Returns the new saved state. */
export async function toggleSaved(db: Db, storyId: string): Promise<boolean> {
  const userId = await requireReaderId(db)
  const { data: existing } = await db
    .from('usr_bookmarks')
    .select('story_id')
    .eq('user_id', userId)
    .eq('story_id', storyId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('usr_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('story_id', storyId)
    if (error) throw error
    return false
  }

  const { error } = await db.from('usr_bookmarks').insert({ user_id: userId, story_id: storyId })
  if (error) throw error
  return true
}

export async function fetchSavedStories(db: Db): Promise<StoryCard[]> {
  const ids = await fetchSavedIds(db)
  if (ids.size === 0) return []

  const { data, error } = await db
    .from('cnt_story_cards')
    .select('*')
    .in('id', [...ids])
    .order('published_at', { ascending: false })
  if (error) throw error
  return data.map(toStoryCard)
}

export async function fetchReactedIds(db: Db): Promise<Set<string>> {
  const userId = await currentReaderId(db)
  if (!userId) return new Set()

  const { data, error } = await db.from('com_reactions').select('story_id').eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((row) => row.story_id))
}

/**
 * Returns the new reaction state. cnt_stories.like_count is kept in step by a
 * database trigger, so the client never writes a count.
 */
export async function toggleReaction(db: Db, storyId: string): Promise<boolean> {
  const userId = await requireReaderId(db)
  const { data: existing } = await db
    .from('com_reactions')
    .select('story_id')
    .eq('user_id', userId)
    .eq('story_id', storyId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('com_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('story_id', storyId)
    if (error) throw error
    return false
  }

  const { error } = await db.from('com_reactions').insert({ user_id: userId, story_id: storyId })
  if (error) throw error
  return true
}

export async function recordProgress(db: Db, storyId: string, partNumber: number): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('usr_read_progress')
    .upsert({ user_id: userId, story_id: storyId, last_part_number: partNumber })
  if (error) throw error
}

export type InProgress = { story: StoryCard; lastPart: number }

/** Stories the reader has started, most recently read first. */
export async function fetchContinueReading(db: Db, limit = 5): Promise<InProgress[]> {
  const userId = await currentReaderId(db)
  if (!userId) return []

  const { data: progress, error } = await db
    .from('usr_read_progress')
    .select('story_id, last_part_number')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (progress.length === 0) return []

  const { data: cards, error: cardsError } = await db
    .from('cnt_story_cards')
    .select('*')
    .in(
      'id',
      progress.map((row) => row.story_id),
    )
  if (cardsError) throw cardsError

  const byId = new Map(cards.map((row) => [row.id!, toStoryCard(row)]))
  // Preserve the recency order of the progress rows.
  return progress.flatMap((row) => {
    const story = byId.get(row.story_id)
    return story ? [{ story, lastPart: row.last_part_number }] : []
  })
}
