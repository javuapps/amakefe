import { currentReaderId, requireReaderId, type Db } from '../supabase'
import {
  toAnsweredQuestion,
  toAnswer,
  toCreatorPost,
  toQuestionCard,
  type Answer,
  type AnsweredQuestion,
  type CreatorPost,
  type Poll,
  type QuestionCard,
} from '../models/community'

export async function fetchLatestCreatorPost(db: Db): Promise<CreatorPost | null> {
  const { data, error } = await db
    .from('cnt_creator_posts')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? toCreatorPost(data) : null
}

export async function fetchQuestions(db: Db, limit = 10): Promise<QuestionCard[]> {
  const { data, error } = await db
    .from('com_question_cards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map(toQuestionCard)
}

export async function fetchAnswers(db: Db, questionId: string): Promise<Answer[]> {
  const { data, error } = await db
    .from('com_answers')
    .select('*')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toAnswer)
}

export async function postAnswer(db: Db, questionId: string, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_answers')
    .insert({ question_id: questionId, user_id: userId, body })
  if (error) throw error
}

export async function postQuestion(db: Db, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db.from('com_questions').insert({ user_id: userId, body })
  if (error) throw error
}

/** The active poll with its tallies, and this reader's vote if they cast one. */
export async function fetchActivePoll(db: Db): Promise<Poll | null> {
  const { data: poll, error } = await db
    .from('com_polls')
    .select('id, question')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!poll) return null

  const { data: results, error: resultsError } = await db
    .from('com_poll_results')
    .select('option_id, label, vote_count, sort_order')
    .eq('poll_id', poll.id)
    .order('sort_order')
  if (resultsError) throw resultsError

  const userId = await currentReaderId(db)
  let myOptionId: string | null = null
  if (userId) {
    const { data: vote } = await db
      .from('com_poll_votes')
      .select('option_id')
      .eq('poll_id', poll.id)
      .eq('user_id', userId)
      .maybeSingle()
    myOptionId = vote?.option_id ?? null
  }

  const options = results.map((row) => ({
    optionId: row.option_id!,
    label: row.label!,
    voteCount: row.vote_count ?? 0,
  }))

  return {
    id: poll.id,
    question: poll.question,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
    myOptionId,
  }
}

/** One vote per reader per poll; voting again moves the vote. */
export async function castVote(db: Db, pollId: string, optionId: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db
    .from('com_poll_votes')
    .upsert({ poll_id: pollId, user_id: userId, option_id: optionId })
  if (error) throw error
}

export async function fetchAnsweredQuestions(db: Db, limit = 20): Promise<AnsweredQuestion[]> {
  const { data, error } = await db
    .from('com_ask_questions')
    .select('*')
    .eq('is_published', true)
    .order('answered_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map(toAnsweredQuestion)
}

/** Ask Her. The question carries the reader's anonymous uid and nothing else. */
export async function askQuestion(db: Db, body: string): Promise<void> {
  const userId = await requireReaderId(db)
  const { error } = await db.from('com_ask_questions').insert({ user_id: userId, body })
  if (error) throw error
}
