import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPart,
  createStory,
  deletePart,
  fetchCategories,
  fetchDashboardStats,
  answerQuestion,
  createNotice,
  createPoll,
  deletePost,
  fetchAskerNames,
  fetchModerationQueue,
  fetchPostsByKind,
  setPostPublished,
  fetchFacebookPostStats,
  fetchPublications,
  fetchSeriesRetention,
  fetchStoryPerformance,
  fetchStorySummaries,
  connectFacebookPage,
  disconnectFacebook,
  fetchFacebookConnection,
  fetchPartStats,
  fetchPendingPages,
  fetchStoryComments,
  fetchStudioStories,
  fetchStudioTotals,
  fetchStudioStory,
  downloadSettlementReport,
  fetchEditorName,
  fetchSettlementPayments,
  fetchSettlementAccount,
  fetchSettlements,
  fetchSupportByPlacement,
  fetchSupportTotals,
  fetchSupportTransactions,
  saveEditorName,
  hideComment,
  type CommentKind,
  keepComment,
  postPublicationNow,
  planPublication,
  publishPart,
  reorderParts,
  savePartMeta,
  saveStoryMetadata,
  schedulePart,
  unpublishPart,
  type Channel,
  type NewStory,
  type PartMetaPatch,
  type StoryFilters,
  type StoryMetadataPatch,
  type StudioStory,
  type PostKind,
} from '@amakefe/core'
import { db } from '../db'

export const keys = {
  dashboard: ['dashboard'] as const,
  performance: ['performance'] as const,
  retention: (storyId: string) => ['retention', storyId] as const,
  summaries: ['storySummaries'] as const,
  stories: (filters: StoryFilters) => ['stories', filters] as const,
  totals: ['studioTotals'] as const,
  facebook: ['facebookConnection'] as const,
  pendingPages: (pendingId: string) => ['facebookPendingPages', pendingId] as const,
  story: (storyId: string) => ['story', storyId] as const,
  publications: (storyId: string) => ['publications', storyId] as const,
  partStats: (storyId: string, partNumber: number) => ['partStats', storyId, partNumber] as const,
  comments: (storyId: string) => ['comments', storyId] as const,
  categories: ['categories'] as const,
  moderation: ['moderation'] as const,
  community: ['community'] as const,
  posts: (kind: string) => ['community', kind] as const,
  askers: ['community', 'askers'] as const,
  support: ['support'] as const,
  supportTotals: ['supportTotals'] as const,
  supportPlacements: ['supportPlacements'] as const,
  settlements: ['settlements'] as const,
  settlementAccount: ['settlementAccount'] as const,
  settlementPayments: (id: string) => ['settlementPayments', id] as const,
  editorName: ['editorName'] as const,
}

export const useDashboardStats = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => fetchDashboardStats(db) })

export const useStoryPerformance = () =>
  useQuery({ queryKey: keys.performance, queryFn: () => fetchStoryPerformance(db) })

export const useSeriesRetention = (storyId: string | undefined) =>
  useQuery({
    queryKey: keys.retention(storyId ?? ''),
    queryFn: () => fetchSeriesRetention(db, storyId!),
    enabled: Boolean(storyId),
  })

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => fetchCategories(db) })

/**
 * The studio's story index — searched, filtered and paged in Postgres.
 *
 * `placeholderData` keeps the previous page on screen while the next one loads,
 * so paging does not blink through a skeleton every time.
 */
export const useStudioStories = (filters: StoryFilters) =>
  useQuery({
    queryKey: keys.stories(filters),
    queryFn: () => fetchStudioStories(db, filters),
    placeholderData: (previous) => previous,
  })

export const usePartStats = (storyId: string | undefined, partNumber: number | undefined) =>
  useQuery({
    queryKey: keys.partStats(storyId ?? '', partNumber ?? 0),
    queryFn: () => fetchPartStats(db, storyId!, partNumber!),
    enabled: Boolean(storyId && partNumber),
  })

export const useStoryComments = (storyId: string | undefined) =>
  useQuery({
    queryKey: keys.comments(storyId ?? ''),
    queryFn: () => fetchStoryComments(db, storyId!),
    enabled: Boolean(storyId),
  })

export const useFacebookConnection = () =>
  useQuery({ queryKey: keys.facebook, queryFn: () => fetchFacebookConnection(db) })

export const usePendingPages = (pendingId: string) =>
  useQuery({
    queryKey: keys.pendingPages(pendingId),
    queryFn: () => fetchPendingPages(db, pendingId),
  })

export function useConnectFacebookPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pendingId, pageId }: { pendingId: string; pageId: string }) =>
      connectFacebookPage(db, pendingId, pageId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.facebook }),
  })
}

export function useDisconnectFacebook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => disconnectFacebook(db),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.facebook }),
  })
}

/** Sends one planned post straight away, rather than waiting for the schedule. */
export function usePostNow(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (publicationId: string) => postPublicationNow(db, publicationId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.publications(storyId) }),
  })
}

export const useStudioTotals = () =>
  useQuery({ queryKey: keys.totals, queryFn: () => fetchStudioTotals(db) })

/**
 * Story metadata without any bodies — for the picker, Series and Schedule.
 * Autosave writes every second or two, so these screens must never pull bodies;
 * `word_count` is a generated column so that this shape is enough for them.
 */
export const useStorySummaries = () =>
  useQuery({ queryKey: keys.summaries, queryFn: () => fetchStorySummaries(db) })

/**
 * Refetches one story and the summaries.
 *
 * Autosave writes the body straight through `savePartBody` rather than a
 * mutation, so nothing invalidates while the studio is open — which is fine, as
 * the page behind it is covered. It is not fine once the studio closes: the
 * cached part still holds the body from before it was opened. Call this then.
 */
export function useRefreshStory(storyId: string | undefined) {
  const client = useQueryClient()
  return useCallback(() => {
    if (!storyId) return
    client.invalidateQueries({ queryKey: keys.story(storyId) })
    client.invalidateQueries({ queryKey: keys.summaries })
    client.invalidateQueries({ queryKey: ['stories'] })
  }, [client, storyId])
}

export const useStudioStory = (storyId: string | undefined) =>
  useQuery({
    queryKey: keys.story(storyId ?? ''),
    queryFn: () => fetchStudioStory(db, storyId!),
    enabled: Boolean(storyId),
  })

export const usePublications = (storyId: string | undefined) =>
  useQuery({
    queryKey: keys.publications(storyId ?? ''),
    queryFn: () => fetchPublications(db, storyId!),
    enabled: Boolean(storyId),
  })

/**
 * Live numbers for one Facebook post. Fetched on open and not cached for long:
 * they change all day, and a stale reach figure is worse than none.
 */
export const useFacebookPostStats = (publicationId: string) =>
  useQuery({
    queryKey: [...keys.publications('post-stats'), publicationId],
    queryFn: () => fetchFacebookPostStats(db, publicationId),
    staleTime: 60_000,
    retry: false,
  })

export const useModerationQueue = () =>
  useQuery({ queryKey: keys.moderation, queryFn: () => fetchModerationQueue(db) })

export const useSupportTransactions = () =>
  useQuery({ queryKey: keys.support, queryFn: () => fetchSupportTransactions(db) })

export const useEditorName = () =>
  useQuery({ queryKey: keys.editorName, queryFn: () => fetchEditorName(db) })

export function useSaveEditorName() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: { firstName: string; lastName: string }) => saveEditorName(db, name),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.editorName }),
  })
}

export const useSupportTotals = () =>
  useQuery({ queryKey: keys.supportTotals, queryFn: () => fetchSupportTotals(db) })

/** Which ask people answer. Payments, not people — see the query. */
export const useSupportPlacements = () =>
  useQuery({ queryKey: keys.supportPlacements, queryFn: () => fetchSupportByPlacement(db) })

export const useSettlements = () =>
  useQuery({ queryKey: keys.settlements, queryFn: () => fetchSettlements(db) })

export const useSettlementAccount = () =>
  useQuery({ queryKey: keys.settlementAccount, queryFn: () => fetchSettlementAccount(db) })

/** What a payout covered. Only fetched once its row is opened. */
export const useSettlementPayments = (settlementId: string | null) =>
  useQuery({
    queryKey: keys.settlementPayments(settlementId ?? ''),
    enabled: settlementId !== null,
    queryFn: () => fetchSettlementPayments(db, settlementId!),
  })

/**
 * The same statement the operators hold — one renderer, called by both apps,
 * so there is never a question of which of two documents is right.
 */
export const useDownloadStatement = () =>
  useMutation({
    mutationFn: (settlement: { id: string; reference: string }) =>
      downloadSettlementReport(db, settlement),
  })

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateStory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewStory) => createStory(db, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useSaveStoryMetadata(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: StoryMetadataPatch) => saveStoryMetadata(db, storyId, patch),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.story(storyId) })
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useSavePartMeta(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ partId, ...patch }: PartMetaPatch & { partId: string }) =>
      savePartMeta(db, partId, patch),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.story(storyId) })
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useAddPart(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (partNumber: number) => addPart(db, storyId, partNumber),
    // The new part goes straight into the cached story rather than waiting on a
    // refetch: the caller opens the studio on it the moment this resolves, and
    // an invalidation would not have landed by then.
    onSuccess: (part) => {
      client.setQueryData<StudioStory>(keys.story(storyId), (story) =>
        story ? { ...story, parts: [...story.parts, part] } : story,
      )
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useDeletePart(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (partId: string) => deletePart(db, partId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.story(storyId) }),
  })
}

export function useReorderParts(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (partIds: string[]) => reorderParts(db, storyId, partIds),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.story(storyId) }),
  })
}

/**
 * Publish and unpublish act on a part, because a part is the thing readers open.
 * The story follows: it is visible exactly while one of its parts is.
 */
export function usePublishPart(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ partId, publish }: { partId: string; publish: boolean }) =>
      publish ? publishPart(db, partId) : unpublishPart(db, partId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.story(storyId) })
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
      client.invalidateQueries({ queryKey: keys.performance })
    },
  })
}

/** `at: null` clears the schedule, which is the same column as unpublishing. */
export function useSchedulePart() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ partId, at }: { partId: string; at: Date | null }) =>
      at ? schedulePart(db, partId, at) : unpublishPart(db, partId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.summaries })
      client.invalidateQueries({ queryKey: ['stories'] })
      // Also every open story: scheduling is reachable from inside the studio,
      // whose panel reads the part's publishedAt to decide what to show.
      client.invalidateQueries({ queryKey: ['story'] })
    },
  })
}

export function usePlanPublication(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      partId: string
      channel: Channel
      scheduledFor?: Date | null
      payload: Record<string, unknown>
    }) => planPublication(db, { storyId, ...input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.publications(storyId) }),
  })
}

export function useModerate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      kind,
      commentId,
      action,
    }: {
      kind: CommentKind
      commentId: string
      action: 'hide' | 'keep'
    }) =>
      action === 'hide' ? hideComment(db, kind, commentId) : keepComment(db, kind, commentId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.moderation }),
  })
}

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export const usePosts = (kind: PostKind) =>
  useQuery({ queryKey: keys.posts(kind), queryFn: () => fetchPostsByKind(db, kind) })

/** Who asked, for the questions on screen. Staff only; never shown to readers. */
export const useAskerNames = (postIds: string[]) =>
  useQuery({
    queryKey: [...keys.askers, postIds.join(',')],
    queryFn: () => fetchAskerNames(db, postIds),
    enabled: postIds.length > 0,
  })

function useCommunityMutation<T>(fn: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    // Every one of these can move a post between the three lists, so all of
    // them are refreshed rather than guessing which.
    onSuccess: () => client.invalidateQueries({ queryKey: keys.community }),
  })
}

export const useAnswerQuestion = () =>
  useCommunityMutation(({ postId, answer }: { postId: string; answer: string }) =>
    answerQuestion(db, postId, answer),
  )

export const useSetPostPublished = () =>
  useCommunityMutation(({ postId, publish }: { postId: string; publish: boolean }) =>
    setPostPublished(db, postId, publish),
  )

export const useCreateNotice = () => useCommunityMutation((body: string) => createNotice(db, body))

export const useCreatePoll = () =>
  useCommunityMutation(({ question, labels }: { question: string; labels: string[] }) =>
    createPoll(db, question, labels),
  )

export const useDeletePost = () => useCommunityMutation((postId: string) => deletePost(db, postId))
