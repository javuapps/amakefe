import { useEffect } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  fetchCategories,
  fetchContinueReading,
  askQuestion,
  castVote,
  fetchCommunityFeed,
  fetchFeed,
  fetchMyQuestions,
  fetchPollDetail,
  fetchPostComments,
  fetchReactedPostIds,
  postComment,
  postStoryComment,
  toggleCommentReaction,
  togglePostReaction,
  fetchRelated,
  fetchFollowedCategorySlugs,
  fetchReaderStats,
  fetchSavedIds,
  fetchSavedStories,
  fetchStory,
  fetchCollectionStatus,
  fetchCommentThread,
  fetchReactedCommentIds,
  fetchSupporterCount,
  recordProgress,
  searchStories,
  setDisplayName,
  startCollection,
  toggleCategoryFollow,
  toggleReaction,
  toggleSaved,
  type CollectionRequest,
  type StoryCard,
} from '@amakefe/core'
import { db } from '../db'

/**
 * Every Supabase call reaches the app through these hooks. Components never
 * touch `db` directly, and no hook re-checks permissions — RLS already decided
 * what the query returns.
 */

/**
 * Cache keys.
 *
 * **An infinite query must never share a key with a plain one.** They cache
 * different shapes — `InfiniteData<T>` against `T` — and whichever mounts
 * second reads the other's data. `useLatestStories` and `useStoryList(null)`
 * both used `['feed', null]`, so opening Home and then Stories crashed inside
 * `getNextPageParam` reading `pages.length` off an array. Hence `latest`.
 */
export const keys = {
  categories: ['categories'] as const,
  /** Paged. Only `useStoryList` may use this. */
  feed: (category: string | null) => ['feed', category] as const,
  /** Home's short unpaged list, kept apart from the paged feed above. */
  latest: ['latest'] as const,
  search: (term: string) => ['search', term] as const,
  story: (slug: string) => ['story', slug] as const,
  related: (id: string) => ['related', id] as const,
  savedIds: ['savedIds'] as const,
  continueReading: ['continueReading'] as const,
  community: ['community'] as const,
  myQuestions: ['my-questions'] as const,
  reactedPosts: ['reactedPosts'] as const,
  poll: (postId: string) => ['poll', postId] as const,
  postComments: (postId: string) => ['postComments', postId] as const,
  readerStats: ['readerStats'] as const,
  savedStories: ['savedStories'] as const,
  followedCategories: ['followedCategories'] as const,
  supporterCount: ['supporterCount'] as const,
  collection: (reference: string) => ['collection', reference] as const,
  storyComments: (storyId: string) => ['storyComments', storyId] as const,
  reactedComments: (storyId: string) => ['reactedComments', storyId] as const,
}

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => fetchCategories(db) })

/** A search term wins over the category chip — someone who typed wants that. */
/**
 * The story list, a page at a time — searched or browsed by category.
 *
 * Both are the same shape, so switching between them does not change how the
 * screen reads its results; only the key changes, which starts a fresh sequence
 * rather than appending one list's pages to another's.
 */
export function useStoryList(category: string | null, term: string) {
  const search = term.trim()
  const searching = search.length >= 2
  return useInfiniteQuery({
    queryKey: searching ? keys.search(search) : keys.feed(category),
    queryFn: ({ pageParam }) =>
      searching
        ? searchStories(db, search, { page: pageParam })
        : fetchFeed(db, { categorySlug: category, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export const useLatestStories = () =>
  useQuery({
    queryKey: keys.latest,
    queryFn: () => fetchFeed(db, { pageSize: 8 }).then((page) => page.items),
  })

export const useStory = (slug: string) =>
  useQuery({ queryKey: keys.story(slug), queryFn: () => fetchStory(db, slug) })

export const useRelated = (story: StoryCard | undefined) =>
  useQuery({
    queryKey: keys.related(story?.id ?? ''),
    queryFn: () => fetchRelated(db, story!),
    enabled: Boolean(story),
  })

export const useSavedIds = () =>
  useQuery({ queryKey: keys.savedIds, queryFn: () => fetchSavedIds(db) })

export const useContinueReading = () =>
  useQuery({ queryKey: keys.continueReading, queryFn: () => fetchContinueReading(db) })

/**
 * The community timeline: questions she has answered, polls and notices, in
 * publication order, a page at a time.
 */
export const useCommunityFeed = () =>
  useInfiniteQuery({
    queryKey: keys.community,
    queryFn: ({ pageParam }) => fetchCommunityFeed(db, { page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })

export const useMyQuestions = () =>
  useQuery({ queryKey: keys.myQuestions, queryFn: () => fetchMyQuestions(db) })

export const useReactedPosts = () =>
  useQuery({ queryKey: keys.reactedPosts, queryFn: () => fetchReactedPostIds(db) })

export const usePollDetail = (postId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.poll(postId),
    queryFn: () => fetchPollDetail(db, postId),
    enabled,
  })

export const usePostComments = (postId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.postComments(postId),
    queryFn: () => fetchPostComments(db, postId),
    enabled,
  })

export function useAskQuestion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => askQuestion(db, body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.myQuestions }),
  })
}

export function useTogglePostReaction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => togglePostReaction(db, postId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.reactedPosts })
      client.invalidateQueries({ queryKey: keys.community })
    },
  })
}

export function usePostComment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      postComment(db, postId, body),
    onSuccess: (_data, { postId }) => {
      client.invalidateQueries({ queryKey: keys.postComments(postId) })
      client.invalidateQueries({ queryKey: keys.community })
    },
  })
}

export function useToggleSaved() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (storyId: string) => toggleSaved(db, storyId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.savedIds }),
  })
}

export function useToggleReaction(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (storyId: string) => toggleReaction(db, storyId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.story(slug) }),
  })
}

export function useRecordProgress() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ storyId, part }: { storyId: string; part: number }) =>
      recordProgress(db, storyId, part),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.continueReading }),
  })
}

export function useCastVote() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) =>
      castVote(db, postId, optionId),
    onSuccess: (_data, { postId }) => {
      client.invalidateQueries({ queryKey: keys.poll(postId) })
      client.invalidateQueries({ queryKey: keys.community })
    },
  })
}

/**
 * A story's thread. Only fetched once the sheet is opened — the count beside
 * the icon comes from the story card, so the closed state costs nothing.
 */
export const useStoryComments = (storyId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.storyComments(storyId),
    enabled,
    queryFn: () => fetchCommentThread(db, storyId),
  })

export const useReactedComments = (storyId: string, ids: string[], enabled: boolean) =>
  useQuery({
    queryKey: keys.reactedComments(storyId),
    enabled: enabled && ids.length > 0,
    queryFn: () => fetchReactedCommentIds(db, ids),
  })

export function usePostStoryComment(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ storyId, body }: { storyId: string; body: string }) =>
      postStoryComment(db, storyId, body),
    onSuccess: (_data, { storyId }) => {
      client.invalidateQueries({ queryKey: keys.storyComments(storyId) })
      // The count lives on the story card, so the icon beside the thread is
      // stale until the story itself is refetched.
      client.invalidateQueries({ queryKey: keys.story(slug) })
    },
  })
}

export function useToggleCommentReaction(storyId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => toggleCommentReaction(db, commentId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.storyComments(storyId) })
      client.invalidateQueries({ queryKey: keys.reactedComments(storyId) })
    },
  })
}

export const useReaderStats = () =>
  useQuery({ queryKey: keys.readerStats, queryFn: () => fetchReaderStats(db) })

export const useSavedStories = () =>
  useQuery({ queryKey: keys.savedStories, queryFn: () => fetchSavedStories(db) })

export const useFollowedCategories = () =>
  useQuery({ queryKey: keys.followedCategories, queryFn: () => fetchFollowedCategorySlugs(db) })

export const useSupporterCount = () =>
  useQuery({ queryKey: keys.supporterCount, queryFn: () => fetchSupporterCount(db) })

/** Prompts the supporter's handset. Resolves with the reference to follow. */
export const useStartCollection = () =>
  useMutation({ mutationFn: (request: CollectionRequest) => startCollection(db, request) })

/**
 * Follows a payment until the network answers.
 *
 * Every three seconds while it is pending and not at all once it is not — the
 * webhook usually lands first, but a handset left face-down on a table is the
 * normal case here, so the screen has to keep asking.
 */
export function useCollectionStatus(reference: string | null) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: keys.collection(reference ?? ''),
    enabled: reference !== null,
    queryFn: () => fetchCollectionStatus(db, reference!),
    // Pure: it only decides whether to ask again. Anything else belongs in the
    // effect below, which React runs after the render rather than during it.
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'pending' ? false : 3000),
  })

  const settled = query.data?.status
  useEffect(() => {
    // A payment that went through changes the number above the button.
    if (settled === 'successful') client.invalidateQueries({ queryKey: keys.supporterCount })
  }, [settled, client])

  return query
}

export function useToggleCategoryFollow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => toggleCategoryFollow(db, slug),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.followedCategories })
      client.invalidateQueries({ queryKey: keys.readerStats })
    },
  })
}


export function useSetDisplayName() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string | null) => setDisplayName(db, name),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.readerStats }),
  })
}
