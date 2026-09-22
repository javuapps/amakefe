import type { Db } from '../supabase'
import type { CommentKind } from './comments'
import type { Enums, Json, Tables } from '../database.types'
import { emptyDoc, type ProseDoc } from '../models/prose'
import { normaliseDocPaths } from './storage'
import type { StoryType } from '../models/story'
import { escapeLike } from './search'

/**
 * Everything the creator studio reads and writes.
 *
 * Read access is enforced twice over: the analytics and editorial RPCs are
 * SECURITY DEFINER functions that check `usr_is_staff()` / `usr_is_editorial()`
 * themselves, and the tables behind them are RLS-guarded.
 *
 * There is no story status. A part is published or it is not, and that is its
 * `publishedAt` — so the studio offers Publish and Unpublish and nothing else.
 */

export type Channel = Enums<'cnt_channel'>

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type DashboardStats = {
  weeklyReaders: number
  storiesStarted: number
  storiesFinished: number
  saves: number
  comments: number
  monthlySupportMinor: number
  supporters: number
}

export async function fetchDashboardStats(db: Db): Promise<DashboardStats | null> {
  const { data, error } = await db.rpc('cnt_dashboard_stats')
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    weeklyReaders: row.weekly_readers,
    storiesStarted: row.stories_started,
    storiesFinished: row.stories_finished,
    saves: row.saves,
    comments: row.comments,
    monthlySupportMinor: Number(row.monthly_support_minor),
    supporters: row.supporters,
  }
}

export type StoryPerformance = {
  storyId: string
  title: string
  categoryName: string | null
  partCount: number
  readers: number
  completion: number
  comments: number
  saves: number
  likes: number
}

export async function fetchStoryPerformance(db: Db): Promise<StoryPerformance[]> {
  const { data, error } = await db.rpc('cnt_story_performance', { p_limit: 20 })
  if (error) throw error
  return data.map((row) => ({
    storyId: row.story_id,
    title: row.title,
    categoryName: row.category_name,
    partCount: row.part_count,
    readers: row.readers,
    completion: Number(row.completion),
    comments: row.comments,
    saves: row.saves,
    likes: row.likes,
  }))
}

export type RetentionPoint = {
  partNumber: number
  publishedAt: Date | null
  readers: number
  share: number
}

export async function fetchSeriesRetention(db: Db, storyId: string): Promise<RetentionPoint[]> {
  const { data, error } = await db.rpc('cnt_series_retention', { p_story_id: storyId })
  if (error) throw error
  return data.map((row) => ({
    partNumber: row.part_number,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    readers: row.readers,
    share: Number(row.share),
  }))
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * A part without its body. Autosave writes every second or two, so the screens
 * that only list parts must never pull bodies — `word_count` is a generated
 * column precisely so this shape is enough for them.
 */
export type StudioPartSummary = {
  id: string
  partNumber: number
  title: string | null
  wordCount: number
  publishedAt: Date | null
  facebookTeaser: string | null
}

/** The story: what it is, and how it is presented. Nothing about writing it. */
export type StudioStorySummary = {
  id: string
  slug: string
  title: string
  summary: string
  categorySlug: string | null
  storyType: StoryType
  plannedPartCount: number | null
  coverImagePath: string | null
  parts: StudioPartSummary[]
}

/** The part: what is written, and what goes out. */
export type StudioPart = StudioPartSummary & {
  body: ProseDoc
  updatedAt: string
  thumbnailPath: string | null
  creatorNote: string | null
  /** Words the database replaces with `**********` wherever this part is published. */
  anonymiseTerms: string[]
}

// `parts` is narrowed rather than intersected: `A & { parts: B[] }` leaves the
// property as `A['parts'] & B[]`, and mapping over that yields the summary type.
export type StudioStory = Omit<StudioStorySummary, 'parts'> & {
  seoTitle: string | null
  metaDescription: string | null
  parts: StudioPart[]
}

/** True when the story runs in parts — the single definition, mirroring SQL. */
export const isSeriesStory = (story: { storyType: StoryType }): boolean =>
  story.storyType === 'series'

/**
 * Where a part stands. There is no status column: a publish time in the past
 * means it is live, one in the future means it is scheduled, and none means it
 * is still a draft.
 */
export type PartState = 'draft' | 'scheduled' | 'live'

export const partState = (part: { publishedAt: Date | null }): PartState => {
  if (!part.publishedAt) return 'draft'
  return part.publishedAt.getTime() <= Date.now() ? 'live' : 'scheduled'
}

/** A story's debut: when its first part went out, or null while it is a draft. */
export const storyPublishedAt = (story: { parts: StudioPartSummary[] }): Date | null =>
  story.parts.reduce<Date | null>(
    (first, part) =>
      part.publishedAt && (!first || part.publishedAt < first) ? part.publishedAt : first,
    null,
  )

const PART_SUMMARY_COLUMNS = 'id, part_number, title, word_count, published_at, facebook_teaser'
const PART_COLUMNS = `${PART_SUMMARY_COLUMNS}, body, updated_at, thumbnail_path, creator_note, anonymise_terms`
const STORY_COLUMNS =
  'id, slug, title, summary, story_type, planned_part_count, cover_image_path, cnt_categories(slug)'

type PartSummaryRow = Pick<
  Tables<'cnt_story_parts'>,
  'id' | 'part_number' | 'title' | 'word_count' | 'published_at' | 'facebook_teaser'
>

const toPartSummary = (row: PartSummaryRow): StudioPartSummary => ({
  id: row.id,
  partNumber: row.part_number,
  title: row.title,
  wordCount: row.word_count ?? 0,
  publishedAt: row.published_at ? new Date(row.published_at) : null,
  facebookTeaser: row.facebook_teaser,
})

type PartRow = PartSummaryRow &
  Pick<
    Tables<'cnt_story_parts'>,
    'body' | 'updated_at' | 'thumbnail_path' | 'creator_note' | 'anonymise_terms'
  >

const toPart = (row: PartRow): StudioPart => ({
  ...toPartSummary(row),
  body: (row.body as ProseDoc | null) ?? emptyDoc(),
  updatedAt: row.updated_at,
  thumbnailPath: row.thumbnail_path,
  creatorNote: row.creator_note,
  anonymiseTerms: row.anonymise_terms ?? [],
})

/**
 * Where a story stands, derived in SQL from its parts. See `cnt_studio_stories`.
 */
export type StoryStatus = 'draft' | 'scheduled' | 'publishing' | 'published'

export const STORY_STATUSES: StoryStatus[] = ['draft', 'scheduled', 'publishing', 'published']

/** One row of the studio's story index. No parts — the story's own page has those. */
export type StudioStoryRow = {
  id: string
  slug: string
  title: string
  summary: string
  storyType: StoryType
  status: StoryStatus
  categorySlug: string
  categoryName: string
  coverImagePath: string | null
  plannedPartCount: number
  partCount: number
  livePartCount: number
  wordCount: number
  firstPublishedAt: Date | null
  viewCount: number
  viewCount7d: number
  reactionCount: number
  commentCount: number
}

export type StoryFilters = {
  search?: string
  status?: StoryStatus | null
  categorySlug?: string | null
  storyType?: StoryType | null
  /** Most read in the last week, rather than newest first. */
  sort?: 'newest' | 'popular'
  page?: number
  pageSize?: number
}

export const STORIES_PER_PAGE = 10

/**
 * The studio's story list: searched, filtered and paged in Postgres.
 *
 * `count: 'exact'` comes back in the Content-Range header, so the screen can
 * show how many pages there are without a second round trip — and without
 * fetching rows it is not going to display.
 */
export async function fetchStudioStories(
  db: Db,
  filters: StoryFilters = {},
): Promise<{ rows: StudioStoryRow[]; total: number }> {
  const page = Math.max(filters.page ?? 1, 1)
  const size = filters.pageSize ?? STORIES_PER_PAGE
  const from = (page - 1) * size

  let query = db.from('cnt_studio_stories').select('*', { count: 'exact' })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categorySlug) query = query.eq('category_slug', filters.categorySlug)
  if (filters.storyType) query = query.eq('story_type', filters.storyType)

  const search = filters.search?.trim()
  if (search) {
    // ilike rather than the tsvector: an editor typing "unfri" expects to find
    // "Unfriendly People", and full-text matches whole lexemes.
    const pattern = `%${escapeLike(search)}%`
    query = query.or(`title.ilike.${pattern},summary.ilike.${pattern}`)
  }

  const { data, error, count } =
    filters.sort === 'popular'
      ? await query
          .order('view_count_7d', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + size - 1)
      : await query.order('created_at', { ascending: false }).range(from, from + size - 1)
  if (error) throw error

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id!,
      slug: row.slug!,
      title: row.title!,
      summary: row.summary ?? '',
      storyType: row.story_type!,
      status: (row.status ?? 'draft') as StoryStatus,
      categorySlug: row.category_slug!,
      categoryName: row.category_name!,
      coverImagePath: row.cover_image_path,
      plannedPartCount: row.planned_part_count ?? 1,
      partCount: row.part_count ?? 0,
      livePartCount: row.live_part_count ?? 0,
      wordCount: row.word_count ?? 0,
      firstPublishedAt: row.first_published_at ? new Date(row.first_published_at) : null,
      viewCount: row.view_count ?? 0,
      viewCount7d: row.view_count_7d ?? 0,
      reactionCount: row.reaction_count ?? 0,
      commentCount: row.comment_count ?? 0,
    })),
    total: count ?? 0,
  }
}

/**
 * How one part is doing.
 *
 * Reads are per part, because `cnt_story_views` counts them that way. Reactions
 * and comments are **per story** — `com_reactions` and `com_comments` key on the
 * story, not the part — so they are returned here labelled as the story's, not
 * quietly presented as this part's.
 */
export type PartStats = {
  views: number
  views7d: number
  /** Newest first, for the last fortnight. */
  byDay: { day: string; views: number }[]
  storyReactions: number
  storyComments: number
}

export async function fetchPartStats(
  db: Db,
  storyId: string,
  partNumber: number,
): Promise<PartStats> {
  const [views, story, comments] = await Promise.all([
    db
      .from('cnt_story_views')
      .select('viewed_on, views')
      .eq('story_id', storyId)
      .eq('part_number', partNumber)
      .order('viewed_on', { ascending: false })
      .limit(14),
    db.from('cnt_stories').select('like_count').eq('id', storyId).single(),
    db
      .from('com_comments')
      .select('id', { count: 'exact', head: true })
      .eq('story_id', storyId)
      .eq('status', 'visible'),
  ])
  if (views.error) throw views.error
  if (story.error) throw story.error
  if (comments.error) throw comments.error

  const rows = views.data ?? []
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return {
    views: rows.reduce((total, row) => total + row.views, 0),
    views7d: rows
      .filter((row) => row.viewed_on > cutoff)
      .reduce((total, row) => total + row.views, 0),
    byDay: rows.map((row) => ({ day: row.viewed_on, views: row.views })),
    storyReactions: story.data.like_count ?? 0,
    storyComments: comments.count ?? 0,
  }
}

export type StoryComment = {
  id: string
  body: string
  createdAt: Date
  authorName: string
  hidden: boolean
}

/** Comments sit on the story, so every part of a series shares them. */
export async function fetchStoryComments(db: Db, storyId: string): Promise<StoryComment[]> {
  const { data, error } = await db
    .from('com_comments')
    .select('id, body, created_at, status, usr_profiles(display_name)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: new Date(row.created_at),
    authorName: row.usr_profiles?.display_name ?? 'Anonymous member',
    hidden: row.status === 'hidden',
  }))
}

export type StudioTotals = {
  stories: number
  published: number
  drafts: number
  views: number
  views7d: number
  reactions: number
  comments: number
}

export async function fetchStudioTotals(db: Db): Promise<StudioTotals | null> {
  const { data, error } = await db.rpc('cnt_studio_totals')
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    stories: row.stories,
    published: row.published,
    drafts: row.drafts,
    views: row.views,
    views7d: row.views_7d,
    reactions: row.reactions,
    comments: row.comments,
  }
}

/** Every story with its parts — for Schedule, which works across all of them. */
export async function fetchStorySummaries(db: Db): Promise<StudioStorySummary[]> {
  const { data, error } = await db
    .from('cnt_stories')
    .select(`${STORY_COLUMNS}, cnt_story_parts(${PART_SUMMARY_COLUMNS})`)
    .order('created_at', { ascending: false })
  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    categorySlug: row.cnt_categories?.slug ?? null,
    storyType: row.story_type,
    plannedPartCount: row.planned_part_count,
    coverImagePath: row.cover_image_path,
    parts: (row.cnt_story_parts ?? []).map(toPartSummary).sort((a, b) => a.partNumber - b.partNumber),
  }))
}

/** One story with the bodies, for the editor. */
export async function fetchStudioStory(db: Db, storyId: string): Promise<StudioStory> {
  const { data, error } = await db
    .from('cnt_stories')
    .select(
      `${STORY_COLUMNS}, seo_title, meta_description,
       cnt_story_parts(${PART_COLUMNS})`,
    )
    .eq('id', storyId)
    .single()
  if (error) throw error

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    categorySlug: data.cnt_categories?.slug ?? null,
    storyType: data.story_type,
    plannedPartCount: data.planned_part_count,
    coverImagePath: data.cover_image_path,
    seoTitle: data.seo_title,
    metaDescription: data.meta_description,
    parts: (data.cnt_story_parts ?? []).map(toPart).sort((a, b) => a.partNumber - b.partNumber),
  }
}

/** What the New Story dialog collects. Everything else is filled in later. */
export type NewStory = {
  title: string
  summary?: string
  storyType?: StoryType
  plannedPartCount?: number | null
  categorySlug?: string | null
}

/**
 * Creates the story and its first part.
 *
 * Nothing about how the story reached her is recorded here: the conversations,
 * the voice notes and the consent all happen away from this platform, and
 * re-entering them while writing would be bookkeeping for something the software
 * never witnessed.
 */
export async function createStory(db: Db, input: NewStory): Promise<string> {
  const { data, error } = await db.rpc('cnt_create_story', {
    p_title: input.title,
    p_summary: input.summary ?? '',
    p_story_type: input.storyType ?? 'single',
    // Omitted rather than passed as null: both arguments have SQL defaults, and
    // the generated Args type takes them as optional.
    p_planned_part_count: input.plannedPartCount ?? undefined,
    p_category_slug: input.categorySlug ?? undefined,
  })
  if (error) throw error
  return data
}

export type StoryMetadataPatch = Partial<{
  title: string
  slug: string
  summary: string
  categorySlug: string | null
  storyType: StoryType
  plannedPartCount: number | null
  seoTitle: string | null
  metaDescription: string | null
  coverImagePath: string | null
}>

export async function saveStoryMetadata(
  db: Db,
  storyId: string,
  patch: StoryMetadataPatch,
): Promise<void> {
  let categoryId: string | undefined
  if (patch.categorySlug !== undefined && patch.categorySlug !== null) {
    const { data, error } = await db
      .from('cnt_categories')
      .select('id')
      .eq('slug', patch.categorySlug)
      .single()
    if (error) throw error
    categoryId = data.id
  }

  const { error } = await db
    .from('cnt_stories')
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(patch.storyType !== undefined ? { story_type: patch.storyType } : {}),
      ...(patch.plannedPartCount !== undefined
        ? { planned_part_count: patch.plannedPartCount }
        : {}),
      ...(patch.seoTitle !== undefined ? { seo_title: patch.seoTitle } : {}),
      ...(patch.metaDescription !== undefined ? { meta_description: patch.metaDescription } : {}),
      ...(patch.coverImagePath !== undefined ? { cover_image_path: patch.coverImagePath } : {}),
    })
    .eq('id', storyId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export class ConcurrentEditError extends Error {
  constructor() {
    super('This part was changed somewhere else. Reload to see the newer version.')
    this.name = 'ConcurrentEditError'
  }
}

/**
 * Autosave. `expectedUpdatedAt` is optimistic concurrency: if another editor
 * saved since this one loaded the part, no row matches and we say so rather than
 * silently overwriting their work.
 */
export async function savePartBody(
  db: Db,
  partId: string,
  body: ProseDoc,
  expectedUpdatedAt: string,
): Promise<string> {
  const { data, error } = await db
    .from('cnt_story_parts')
    .update({ body: normaliseDocPaths(body) as unknown as Json, updated_at: new Date().toISOString() })
    .eq('id', partId)
    .eq('updated_at', expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ConcurrentEditError()
  return data.updated_at
}

export type PartMetaPatch = Partial<{
  title: string | null
  facebookTeaser: string | null
  thumbnailPath: string | null
  creatorNote: string | null
  anonymiseTerms: string[]
}>

export async function savePartMeta(db: Db, partId: string, patch: PartMetaPatch): Promise<void> {
  const { error } = await db
    .from('cnt_story_parts')
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.facebookTeaser !== undefined ? { facebook_teaser: patch.facebookTeaser } : {}),
      ...(patch.thumbnailPath !== undefined ? { thumbnail_path: patch.thumbnailPath } : {}),
      ...(patch.creatorNote !== undefined ? { creator_note: patch.creatorNote } : {}),
      ...(patch.anonymiseTerms !== undefined ? { anonymise_terms: patch.anonymiseTerms } : {}),
    })
    .eq('id', partId)
  if (error) throw error
}

/**
 * Returns the whole new part, so the caller can put it straight into the cached
 * story and open it for writing. Waiting on a refetch instead would mean the
 * editor mounting before the part it is meant to edit exists in the cache.
 */
export async function addPart(db: Db, storyId: string, partNumber: number): Promise<StudioPart> {
  const { data, error } = await db
    .from('cnt_story_parts')
    .insert({ story_id: storyId, part_number: partNumber })
    .select(PART_COLUMNS)
    .single()
  if (error) throw error
  return toPart(data)
}

/** Only ever called for an unpublished part — the UI does not offer it otherwise. */
export async function deletePart(db: Db, partId: string): Promise<void> {
  const { error } = await db.from('cnt_story_parts').delete().eq('id', partId)
  if (error) throw error
}

export async function reorderParts(db: Db, storyId: string, partIds: string[]): Promise<void> {
  const { error } = await db.rpc('cnt_reorder_parts', {
    p_story_id: storyId,
    p_part_ids: partIds,
  })
  if (error) throw error
}

/** Scheduling a part is simply giving it a publish time in the future. */
/**
 * Sets a part's publish time in the future.
 *
 * Through an RPC, not a direct update, because the guards belong with the write:
 * an empty part must not be queued to become a blank page on Tuesday, and a time
 * already past is not a schedule but a publish — which is `publishPart`.
 * Clearing a schedule is `unpublishPart`; it is the same column.
 */
export async function schedulePart(db: Db, partId: string, at: Date): Promise<void> {
  const { error } = await db.rpc('cnt_schedule_part', {
    p_part_id: partId,
    p_at: at.toISOString(),
  })
  if (error) throw error
}

/**
 * Publishing is per part: the story becomes visible because one of its parts is.
 * The RPC refuses an empty part, which is the one mistake that would otherwise
 * put a blank page in front of 200k readers.
 */
export async function publishPart(db: Db, partId: string): Promise<void> {
  const { error } = await db.rpc('cnt_publish_part', { p_part_id: partId })
  if (error) throw error
}

/** Takes a part back off the site. A story with no live part disappears with it. */
export async function unpublishPart(db: Db, partId: string): Promise<void> {
  const { error } = await db.rpc('cnt_unpublish_part', { p_part_id: partId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

export type Publication = {
  id: string
  partId: string | null
  channel: Channel
  status: Enums<'cnt_publication_status'>
  scheduledFor: Date | null
  sentAt: Date | null
  externalUrl: string | null
}

export async function fetchPublications(db: Db, storyId: string): Promise<Publication[]> {
  const { data, error } = await db
    .from('cnt_publications')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    partId: row.part_id,
    channel: row.channel,
    status: row.status,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : null,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    externalUrl: row.external_url,
  }))
}

/**
 * Records that a post is planned for a channel, freezing what will be sent.
 * A later teaser edit therefore cannot silently change what goes out, and a
 * failed post can be replayed exactly. The Graph API worker that consumes these
 * rows is a later phase; nothing in the studio changes when it lands.
 */
export async function planPublication(
  db: Db,
  input: {
    storyId: string
    partId: string
    channel: Channel
    scheduledFor?: Date | null
    payload: Record<string, unknown>
  },
): Promise<string> {
  // Returns the row's id: publishing now plans the post and sends it in one
  // go, and the sender needs to be told which row to send.
  const { data, error } = await db
    .from('cnt_publications')
    .upsert(
      {
        story_id: input.storyId,
        part_id: input.partId,
        channel: input.channel,
        status: 'planned',
        scheduled_for: input.scheduledFor?.toISOString() ?? null,
        payload: input.payload as Json,
        // A re-plan after a refusal starts clean rather than carrying the old
        // reason next to a post that has not been tried yet.
        sent_at: null,
        external_id: null,
        external_url: null,
        error: null,
      },
      { onConflict: 'part_id,channel' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// ---------------------------------------------------------------------------
// Moderation and supporters (unchanged shape, kept here with the rest)
// ---------------------------------------------------------------------------

export type ModerationItem = {
  kind: CommentKind
  id: string
  body: string
  createdAt: Date
  /** The story's title, or the opening of the post it sits under. */
  context: string
  authorName: string
  reportCount: number
  reportReasons: string[]
}

/**
 * Everything readers have written, both kinds at once, most reported first.
 *
 * It used to read `com_comments` alone — story comments, which had no reader
 * UI — so the queue was empty while the comments people could actually leave,
 * under a poll or a notice, were invisible to it. `mod_comment_queue` unions
 * the two, which also lets the ordering be right: "most reported, then newest"
 * cannot be done across two lists sorted separately.
 */
export async function fetchModerationQueue(db: Db): Promise<ModerationItem[]> {
  const [{ data, error }, { data: reports, error: reportsError }] = await Promise.all([
    db
      .from('mod_comment_queue')
      .select('*')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('mod_reports').select('target_kind, target_id, reason').eq('status', 'open'),
  ])
  if (error) throw error
  if (reportsError) throw reportsError

  // Keyed on both halves: the two tables have their own uuids and nothing says
  // they cannot collide.
  const byTarget = new Map<string, string[]>()
  for (const report of reports) {
    const key = `${report.target_kind}:${report.target_id}`
    byTarget.set(key, [...(byTarget.get(key) ?? []), report.reason])
  }

  return data
    .map((row) => {
      const reasons = byTarget.get(`${row.target_kind}:${row.id}`) ?? []
      return {
        kind: row.target_kind as CommentKind,
        id: row.id!,
        body: row.body!,
        createdAt: new Date(row.created_at!),
        context: row.context ?? 'Unknown',
        authorName: row.author_name ?? 'A reader',
        reportCount: reasons.length,
        reportReasons: reasons,
      }
    })
    .sort((a, b) => b.reportCount - a.reportCount || b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Hiding and keeping are one statement each now.
 *
 * They were two — update the comment, then update its reports — which is two
 * chances to do half of a moderator's decision.
 */
export async function hideComment(db: Db, kind: CommentKind, commentId: string): Promise<void> {
  const { error } = await db.rpc('mod_hide_comment', { p_kind: kind, p_id: commentId })
  if (error) throw error
}

export async function keepComment(db: Db, kind: CommentKind, commentId: string): Promise<void> {
  const { error } = await db.rpc('mod_keep_comment', { p_kind: kind, p_id: commentId })
  if (error) throw error
}
