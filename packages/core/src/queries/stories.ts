import type { Db } from '../supabase'
import {
  toStoryCard,
  toStoryPart,
  type Category,
  type Story,
  type StoryCard,
} from '../models/story'

/**
 * Reads published content. Every query here runs as `anon` unless the reader
 * happens to have an anonymous session already — RLS decides what comes back, so
 * there is nothing to gate on the client.
 */

export async function fetchCategories(db: Db): Promise<Category[]> {
  const { data, error } = await db
    .from('cnt_categories')
    .select('slug, name')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function fetchFeed(
  db: Db,
  options: { categorySlug?: string | null; limit?: number } = {},
): Promise<StoryCard[]> {
  const { categorySlug = null, limit = 30 } = options
  let query = db.from('cnt_story_cards').select('*')
  if (categorySlug) query = query.eq('category_slug', categorySlug)

  const { data, error } = await query.order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data.map(toStoryCard)
}

export async function searchStories(db: Db, term: string): Promise<StoryCard[]> {
  const { data, error } = await db.rpc('cnt_search_stories', { p_query: term })
  if (error) throw error
  return data.map(toStoryCard)
}

export async function fetchStory(db: Db, slug: string): Promise<Story> {
  const { data: card, error: cardError } = await db
    .from('cnt_story_cards')
    .select('*')
    .eq('slug', slug)
    .single()
  if (cardError) throw cardError

  // cnt_public_parts, not cnt_story_parts: the table holds the story as it was
  // told, real names and all, and readers cannot select it. The view is the
  // published, redacted projection — see 20260921130000.
  const { data: parts, error: partsError } = await db
    .from('cnt_public_parts')
    .select('*')
    .eq('story_id', card.id!)
    .order('part_number')
  if (partsError) throw partsError

  return { card: toStoryCard(card), parts: parts.map(toStoryPart) }
}

/**
 * Records that a published part was read.
 *
 * Deliberately fire-and-forget and deliberately anonymous: `cnt_story_views`
 * holds a per-day counter and no identity, so this cannot become a record of who
 * read what. A failure is swallowed — a reader must never see an error, or wait,
 * because a statistic did not save.
 */
export async function recordStoryView(
  db: Db,
  storyId: string,
  partNumber: number,
): Promise<void> {
  await db.rpc('cnt_record_view', { p_story_id: storyId, p_part_number: partNumber })
    .then(() => undefined, () => undefined)
}

/** Other stories to read next: same category first, then anything recent. */
export async function fetchRelated(db: Db, to: StoryCard, limit = 2): Promise<StoryCard[]> {
  const { data: sameCategory, error } = await db
    .from('cnt_story_cards')
    .select('*')
    .eq('category_slug', to.categorySlug)
    .neq('id', to.id)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (sameCategory.length >= limit) return sameCategory.map(toStoryCard)

  const { data: recent, error: recentError } = await db
    .from('cnt_story_cards')
    .select('*')
    .neq('id', to.id)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (recentError) throw recentError

  const seen = new Set([to.id])
  return [...sameCategory, ...recent]
    .filter((row) => !seen.has(row.id!) && seen.add(row.id!))
    .slice(0, limit)
    .map(toStoryCard)
}
