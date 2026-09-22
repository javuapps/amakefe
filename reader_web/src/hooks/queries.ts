import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  askQuestion,
  castVote,
  fetchActivePoll,
  fetchAnsweredQuestions,
  fetchCategories,
  fetchContinueReading,
  fetchFeed,
  fetchLatestCreatorPost,
  fetchQuestions,
  fetchRelated,
  fetchFollowedCategorySlugs,
  fetchReaderStats,
  fetchSavedIds,
  fetchSavedStories,
  fetchStory,
  fetchSupporterCount,
  postAnswer,
  recordProgress,
  searchStories,
  toggleCategoryFollow,
  toggleReaction,
  toggleSaved,
  type StoryCard,
} from '@amakefe/core'
import { db } from '../db'

/**
 * Every Supabase call reaches the app through these hooks. Components never
 * touch `db` directly, and no hook re-checks permissions — RLS already decided
 * what the query returns.
 */

export const keys = {
  categories: ['categories'] as const,
  feed: (category: string | null) => ['feed', category] as const,
  search: (term: string) => ['search', term] as const,
  story: (slug: string) => ['story', slug] as const,
  related: (id: string) => ['related', id] as const,
  savedIds: ['savedIds'] as const,
  continueReading: ['continueReading'] as const,
  creatorPost: ['creatorPost'] as const,
  questions: ['questions'] as const,
  poll: ['poll'] as const,
  answered: ['answered'] as const,
  readerStats: ['readerStats'] as const,
  savedStories: ['savedStories'] as const,
  followedCategories: ['followedCategories'] as const,
  supporterCount: ['supporterCount'] as const,
}

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => fetchCategories(db) })

/** A search term wins over the category chip — someone who typed wants that. */
export function useStoryList(category: string | null, term: string) {
  const searching = term.trim().length >= 2
  return useQuery({
    queryKey: searching ? keys.search(term.trim()) : keys.feed(category),
    queryFn: () => (searching ? searchStories(db, term.trim()) : fetchFeed(db, { categorySlug: category })),
  })
}

export const useLatestStories = () =>
  useQuery({ queryKey: keys.feed(null), queryFn: () => fetchFeed(db, { limit: 8 }) })

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

export const useCreatorPost = () =>
  useQuery({ queryKey: keys.creatorPost, queryFn: () => fetchLatestCreatorPost(db) })

export const useQuestions = () =>
  useQuery({ queryKey: keys.questions, queryFn: () => fetchQuestions(db) })

export const useActivePoll = () =>
  useQuery({ queryKey: keys.poll, queryFn: () => fetchActivePoll(db) })

export const useAnsweredQuestions = () =>
  useQuery({ queryKey: keys.answered, queryFn: () => fetchAnsweredQuestions(db) })

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
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      castVote(db, pollId, optionId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.poll }),
  })
}

export function usePostAnswer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      postAnswer(db, questionId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.questions }),
  })
}

export const useAskQuestion = () =>
  useMutation({ mutationFn: (body: string) => askQuestion(db, body) })

export const useReaderStats = () =>
  useQuery({ queryKey: keys.readerStats, queryFn: () => fetchReaderStats(db) })

export const useSavedStories = () =>
  useQuery({ queryKey: keys.savedStories, queryFn: () => fetchSavedStories(db) })

export const useFollowedCategories = () =>
  useQuery({ queryKey: keys.followedCategories, queryFn: () => fetchFollowedCategorySlugs(db) })

export const useSupporterCount = () =>
  useQuery({ queryKey: keys.supporterCount, queryFn: () => fetchSupporterCount(db) })

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

