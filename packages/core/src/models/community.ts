import type { Tables } from '../database.types'

/**
 * The community is one timeline.
 *
 * Three kinds of post share it — a question a reader asked and she answered, a
 * poll, and a notice from her — and readers react and comment on any of them.
 * They are one table with a `kind` rather than three, so the feed is one query
 * in publication order and engagement has somewhere with a foreign key to hang.
 */
export type PostKind = 'question' | 'poll' | 'notice'

export type CommunityPost = {
  id: string
  kind: PostKind
  /** The question asked, the poll's question, or the notice itself. */
  body: string
  /** Her reply. Questions only, and a question reaches the feed only with one. */
  answer: string | null
  answeredAt: Date | null
  closesAt: Date | null
  /** Null while it is still hers alone — a draft, or a question not yet answered. */
  publishedAt: Date | null
  /** When it arrived — for a question, when the reader asked. */
  createdAt: Date
  likeCount: number
  commentCount: number
  voteCount: number
}

export const toCommunityPost = (row: Tables<'com_post_cards'>): CommunityPost => ({
  id: row.id!,
  kind: row.kind as PostKind,
  body: row.body!,
  answer: row.answer,
  answeredAt: row.answered_at ? new Date(row.answered_at) : null,
  closesAt: row.closes_at ? new Date(row.closes_at) : null,
  publishedAt: row.published_at ? new Date(row.published_at) : null,
  createdAt: new Date(row.created_at!),
  likeCount: row.like_count ?? 0,
  commentCount: row.comment_count ?? 0,
  voteCount: row.vote_count ?? 0,
})

/**
 * Where a post has got to, derived rather than stored.
 *
 * The same rule as a story part, for the same reason: a status column beside a
 * publication time is two sources of truth that can disagree, and did.
 */
export type PostState = 'waiting' | 'answered' | 'published'

export const postState = (post: CommunityPost): PostState =>
  post.publishedAt ? 'published' : post.answer || post.kind !== 'question' ? 'answered' : 'waiting'

/** A reader's comment on a post. */
export type PostComment = {
  id: string
  body: string
  authorName: string | null
  createdAt: Date
}

export const toPostComment = (
  row: Tables<'com_post_comments'> & { usr_profiles?: { display_name: string | null } | null },
): PostComment => ({
  id: row.id,
  body: row.body,
  authorName: row.usr_profiles?.display_name ?? null,
  createdAt: new Date(row.created_at),
})

/** One answer a poll offers, with its tally. */
export type PollOption = {
  optionId: string
  label: string
  voteCount: number
}

export const toPollOption = (row: Tables<'com_poll_results'>): PollOption => ({
  optionId: row.option_id!,
  label: row.label!,
  voteCount: row.vote_count ?? 0,
})

/** A poll's options and, if they voted, the reader's own choice. */
export type PollDetail = {
  options: PollOption[]
  myOptionId: string | null
}

export const optionShare = (total: number, option: PollOption): number =>
  total === 0 ? 0 : option.voteCount / total
