import { currentReaderId, requireReaderId, type Db } from '../supabase'
import type { Enums, Tables } from '../database.types'

/**
 * Comments on a story.
 *
 * The community timeline settled what a thread is here, so this follows it:
 * newest last, the reader's chosen name beside each one, and a reaction that
 * is one per person rather than a tally. Reading needs no account; commenting
 * and reacting each need one and throw `NotSignedInError` rather than signing
 * anybody in.
 *
 * Replies are not built. `com_comments.parent_id` has been there since the
 * first schema and nothing writes it — a thread of replies is a different
 * screen and nobody has asked for one yet.
 *
 * Not to be confused with `fetchStoryComments` in `studio.ts`, which reads the
 * same table for moderation: hidden comments included, newest first, capped at
 * fifty. Two audiences, two queries — the names say which is which.
 */
export type ThreadComment = {
  id: string
  body: string
  authorName: string | null
  likeCount: number
  createdAt: Date
}

const toThreadComment = (
  row: Tables<'com_comments'> & { usr_profiles?: { display_name: string | null } | null },
): ThreadComment => ({
  id: row.id,
  body: row.body,
  authorName: row.usr_profiles?.display_name ?? null,
  likeCount: row.like_count,
  createdAt: new Date(row.created_at),
})

/**
 * The visible thread, oldest first — a conversation is read in the order it
 * happened, unlike a feed.
 *
 * The profile embed is what the re-pointed foreign key bought: through the old
 * one, to `auth.users`, PostgREST had no relationship to follow and the name
 * would have needed a second round trip.
 */
export async function fetchCommentThread(db: Db, storyId: string): Promise<ThreadComment[]> {
  const { data, error } = await db
    .from('com_comments')
    .select('*, usr_profiles(display_name)')
    .eq('story_id', storyId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toThreadComment)
}

/** Comments carry the reader's chosen name. The story they are about does not. */
export async function postStoryComment(db: Db, storyId: string, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_comments')
    .insert({ story_id: storyId, user_id: userId, body: body.trim() })
  if (error) throw error
}

/** Which of these the reader has already reacted to, for filling in the hearts. */
export async function fetchReactedCommentIds(
  db: Db,
  commentIds: string[],
): Promise<Set<string>> {
  const userId = await currentReaderId(db)
  if (!userId || commentIds.length === 0) return new Set()

  const { data, error } = await db
    .from('com_comment_reactions')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds)
  if (error) throw error
  return new Set(data.map((row) => row.comment_id))
}

/** Returns the new reacted state. `like_count` is kept up to date by a trigger. */
export async function toggleCommentReaction(db: Db, commentId: string): Promise<boolean> {
  const userId = await requireReaderId(db)

  const { data: existing } = await db
    .from('com_comment_reactions')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('com_comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
    if (error) throw error
    return false
  }

  const { error } = await db
    .from('com_comment_reactions')
    .insert({ comment_id: commentId, user_id: userId })
  if (error) throw error
  return true
}

/** Which comment table a report is about. */
export type CommentKind = Extract<Enums<'mod_target_kind'>, 'story_comment' | 'post_comment'>

/**
 * Reports a comment to the moderators.
 *
 * The one thing a reader can do about someone else's words, and until now
 * there was no way to do it: `mod_reports` had an insert policy from the first
 * schema and nothing ever called it, so the studio's queue only ever showed
 * what a moderator happened to scroll past.
 *
 * A unique constraint on (kind, target, reporter) means reporting twice is not
 * two reports. That comes back as a duplicate-key error, which the caller
 * should treat as "already reported" rather than a failure — the reader's
 * intent was satisfied either way.
 */
export async function reportComment(
  db: Db,
  kind: CommentKind,
  commentId: string,
  reason: string,
): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db.from('mod_reports').insert({
    target_kind: kind,
    target_id: commentId,
    reporter_id: userId,
    reason: reason.trim(),
  })
  // 23505 is the unique violation: they have reported this one before.
  if (error && error.code !== '23505') throw error
}
