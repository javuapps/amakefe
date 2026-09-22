import type { Enums, Tables } from '../database.types'
import { emptyDoc, type ProseDoc } from './prose'

/**
 * Postgres reports every column of a view as nullable because it cannot prove
 * non-nullness through the LEFT JOIN LATERAL. The underlying columns are NOT
 * NULL, so the mapper below narrows once, here, rather than forcing every call
 * site to cope with nulls that never arrive.
 */
type StoryCardRow = Tables<'cnt_story_cards'>

/** One story, or a series that runs in parts. */
export type StoryType = Enums<'cnt_story_type'>

export type StoryCard = {
  id: string
  slug: string
  title: string
  summary: string
  categorySlug: string
  categoryName: string
  storyType: StoryType
  publishedAt: Date
  likeCount: number
  coverImagePath: string | null
  /** Parts published so far. */
  partCount: number
  /** Parts the series will run to, once the creator has announced a length. */
  totalPartCount: number
  readMinutes: number
}

export function toStoryCard(row: StoryCardRow): StoryCard {
  return {
    id: row.id!,
    slug: row.slug!,
    title: row.title!,
    summary: row.summary!,
    categorySlug: row.category_slug!,
    categoryName: row.category_name!,
    storyType: row.story_type!,
    publishedAt: new Date(row.published_at!),
    likeCount: row.like_count ?? 0,
    coverImagePath: row.cover_image_path,
    partCount: row.part_count ?? 0,
    totalPartCount: row.total_part_count ?? 0,
    readMinutes: row.read_minutes ?? 0,
  }
}

export const isSeries = (story: StoryCard) => story.storyType === 'series'

/** "5 parts", or "3 of 5 parts" while a series is still running. */
export function partsLabel(story: StoryCard): string {
  if (!isSeries(story)) return `${story.readMinutes} min read`
  if (story.partCount < story.totalPartCount) {
    return `${story.partCount} of ${story.totalPartCount} parts`
  }
  return `${story.totalPartCount} parts`
}

/**
 * The line under every story title: category and length.
 *
 * There is no byline. Every story here is written by Amake Fe from something
 * someone told her, and the contributor is anonymous — so a credit would either
 * repeat what the reader knows or invent a persona.
 */
export const storyMeta = (story: StoryCard) =>
  `${story.categoryName} · ${partsLabel(story)}`

/**
 * The prototype's cover tile shows the first meaningful letter of the title,
 * skipping a leading article or pronoun.
 */
export function storyInitial(story: Pick<StoryCard, 'title'>): string {
  const stripped = story.title.replace(/^(the|a|an|my|we|he|she|nothing)\s+/i, '')
  const source = stripped || story.title
  return source.charAt(0).toUpperCase()
}

/**
 * Where Home's reading card should send someone.
 *
 * `lastPart` is the part they finished, or null for a reader who has not started
 * this story. The next part never runs past what has actually been published —
 * offering "Part 6 of 5" on a series still being written is the obvious way to
 * get this wrong.
 */
export function resumePoint(
  story: StoryCard,
  lastPart: number | null,
): { nextPart: number; progress: number; resuming: boolean } {
  if (lastPart === null) {
    return { nextPart: 1, progress: 0, resuming: false }
  }
  const published = Math.max(story.partCount, 1)
  return {
    nextPart: Math.min(lastPart + 1, published),
    progress: story.totalPartCount > 0 ? Math.min(lastPart / story.totalPartCount, 1) : 0,
    resuming: true,
  }
}

export type StoryPart = {
  partNumber: number
  title: string | null
  body: ProseDoc
  readMinutes: number
  thumbnailPath: string | null
  /** Shown after this part — her voice, not the contributor's. */
  creatorNote: string | null
}

/**
 * From `cnt_public_parts`, whose columns Postgres reports as nullable because
 * it cannot prove otherwise through the view. Readers never see the underlying
 * table, so this is the only shape a story part arrives in.
 */
export function toStoryPart(row: Tables<'cnt_public_parts'>): StoryPart {
  return {
    partNumber: row.part_number!,
    title: row.title,
    body: (row.body as ProseDoc | null) ?? emptyDoc(),
    readMinutes: row.read_minutes ?? 1,
    thumbnailPath: row.thumbnail_path,
    creatorNote: row.creator_note,
  }
}

/** A story opened in the reader. */
export type Story = {
  card: StoryCard
  parts: StoryPart[]
}

export type Category = { slug: string; name: string }
