import { currentReaderId, requireReaderId, type Db } from '../supabase'
import {
  toCommunityPost,
  toPollOption,
  toPostComment,
  type CommunityPost,
  type PollDetail,
  type PostComment,
  type PostKind,
} from '../models/community'

/**
 * The community timeline, and everything readers do to it.
 *
 * Reading needs no account. Asking, reacting, voting and commenting each need
 * one, and each throws `NotSignedInError` rather than signing anybody in — the
 * app decides when to ask.
 */

export const COMMUNITY_PAGE_SIZE = 10

export type PostPage = { items: CommunityPost[]; hasMore: boolean }

/**
 * One page of the timeline, newest first.
 *
 * RLS decides what is on it: everything published, plus the reader's own
 * questions while they wait. One row past the page tells us whether there is
 * another without a count.
 */
export async function fetchCommunityFeed(
  db: Db,
  options: { page?: number; pageSize?: number } = {},
): Promise<PostPage> {
  const { page = 0, pageSize = COMMUNITY_PAGE_SIZE } = options
  const from = page * pageSize

  const { data, error } = await db
    .from('com_post_cards')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(from, from + pageSize)
  if (error) throw error

  return { items: data.slice(0, pageSize).map(toCommunityPost), hasMore: data.length > pageSize }
}

/** The reader's own questions, answered or still waiting. */
export async function fetchMyQuestions(db: Db): Promise<CommunityPost[]> {
  const userId = await currentReaderId(db)
  if (!userId) return []

  const { data, error } = await db
    .from('com_post_cards')
    .select('*')
    .eq('asked_by', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toCommunityPost)
}

/**
 * Asks her something.
 *
 * It is not on the timeline yet and carries no answer — the insert policy
 * enforces both, so a reader cannot publish their own question or answer it.
 */
export async function askQuestion(db: Db, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_posts')
    .insert({ kind: 'question', body, asked_by: userId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Reacting and commenting
// ---------------------------------------------------------------------------

/** The posts this reader has reacted to, for filling in the hearts. */
export async function fetchReactedPostIds(db: Db): Promise<Set<string>> {
  const userId = await currentReaderId(db)
  if (!userId) return new Set()

  const { data, error } = await db
    .from('com_post_reactions')
    .select('post_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((row) => row.post_id))
}

/** Returns the new reacted state. `like_count` is kept up to date by a trigger. */
export async function togglePostReaction(db: Db, postId: string): Promise<boolean> {
  const userId = await requireReaderId(db)

  const { data: existing } = await db
    .from('com_post_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('com_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
    return false
  }

  const { error } = await db
    .from('com_post_reactions')
    .insert({ post_id: postId, user_id: userId })
  if (error) throw error
  return true
}

export async function fetchPostComments(db: Db, postId: string): Promise<PostComment[]> {
  const { data, error } = await db
    .from('com_post_comments')
    .select('*, usr_profiles(display_name)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toPostComment)
}

/** Comments carry the reader's chosen name — unlike the question that started it. */
export async function postComment(db: Db, postId: string, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_post_comments')
    .insert({ post_id: postId, user_id: userId, body })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

/** A poll's options with their tallies, and this reader's vote if they cast one. */
export async function fetchPollDetail(db: Db, postId: string): Promise<PollDetail> {
  const userId = await currentReaderId(db)

  const [{ data: options, error }, mine] = await Promise.all([
    db.from('com_poll_results').select('*').eq('poll_id', postId).order('sort_order'),
    userId
      ? db
          .from('com_poll_votes')
          .select('option_id')
          .eq('poll_id', postId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (error) throw error

  return {
    options: (options ?? []).map(toPollOption),
    myOptionId: mine.data?.option_id ?? null,
  }
}

/** One vote per reader per poll; voting again moves it. */
export async function castVote(db: Db, postId: string, optionId: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_poll_votes')
    .upsert({ poll_id: postId, user_id: userId, option_id: optionId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// The studio
// ---------------------------------------------------------------------------

/** Every post of a kind, newest first — hers to work through. */
export async function fetchPostsByKind(db: Db, kind: PostKind): Promise<CommunityPost[]> {
  const { data, error } = await db
    .from('com_post_cards')
    .select('*')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toCommunityPost)
}

/** Who asked — staff only, and never shown to readers. */
export async function fetchAskerNames(db: Db, postIds: string[]): Promise<Map<string, string>> {
  if (postIds.length === 0) return new Map()

  const { data, error } = await db
    .from('com_posts')
    .select('id, usr_profiles(display_name)')
    .in('id', postIds)
    .not('asked_by', 'is', null)
  if (error) throw error

  return new Map(
    data.flatMap((row) =>
      row.usr_profiles?.display_name ? [[row.id, row.usr_profiles.display_name] as const] : [],
    ),
  )
}

/**
 * Writes her answer. The timestamp moves with the text, because the check
 * constraint refuses one without the other.
 */
export async function answerQuestion(db: Db, postId: string, answer: string): Promise<void> {
  const trimmed = answer.trim()
  const { error } = await db
    .from('com_posts')
    .update({ answer: trimmed || null, answered_at: trimmed ? new Date().toISOString() : null })
    .eq('id', postId)
  if (error) throw error
}

/** Puts a post on the timeline, or takes it back off. */
export async function setPostPublished(
  db: Db,
  postId: string,
  publish: boolean,
): Promise<void> {
  const { error } = await db
    .from('com_posts')
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq('id', postId)
  if (error) throw error
}

export async function createNotice(db: Db, body: string): Promise<string> {
  const { data, error } = await db
    .from('com_posts')
    .insert({ kind: 'notice', body })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** A poll and its options are one act — a poll with nothing to choose is not one. */
export async function createPoll(db: Db, question: string, labels: string[]): Promise<string> {
  const { data, error } = await db
    .from('com_posts')
    .insert({ kind: 'poll', body: question })
    .select('id')
    .single()
  if (error) throw error

  const { error: optionsError } = await db.from('com_poll_options').insert(
    labels.map((label, index) => ({ poll_id: data.id, label, sort_order: index })),
  )
  if (optionsError) throw optionsError
  return data.id
}

export async function deletePost(db: Db, postId: string): Promise<void> {
  const { error } = await db.from('com_posts').delete().eq('id', postId)
  if (error) throw error
}
