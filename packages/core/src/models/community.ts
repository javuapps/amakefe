import type { Tables } from '../database.types'

/** A short post from the creator — an announcement, not a story. */
export type CreatorPost = {
  id: string
  body: string
  publishedAt: Date
}

export const toCreatorPost = (row: Tables<'cnt_creator_posts'>): CreatorPost => ({
  id: row.id,
  body: row.body,
  publishedAt: new Date(row.published_at!),
})

/** A discussion prompt with its answers, as the Community list shows it. */
export type QuestionCard = {
  id: string
  body: string
  createdAt: Date
  answerCount: number
  latestAnswer: string | null
  /** Who wrote the quoted answer. Null for an answer the creator entered herself. */
  latestAnswerAuthor: string | null
}

export const toQuestionCard = (row: Tables<'com_question_cards'>): QuestionCard => ({
  id: row.id!,
  body: row.body!,
  createdAt: new Date(row.created_at!),
  answerCount: row.answer_count ?? 0,
  latestAnswer: row.latest_answer,
  latestAnswerAuthor: row.latest_answer_author,
})

export type Answer = {
  id: string
  body: string
  createdAt: Date
}

export const toAnswer = (row: Tables<'com_answers'>): Answer => ({
  id: row.id,
  body: row.body,
  createdAt: new Date(row.created_at),
})

export type PollOption = {
  optionId: string
  label: string
  voteCount: number
}

export type Poll = {
  id: string
  question: string
  options: PollOption[]
  totalVotes: number
  /** The option this reader chose, if they have voted. */
  myOptionId: string | null
}

export const optionShare = (poll: Poll, option: PollOption): number =>
  poll.totalVotes === 0 ? 0 : option.voteCount / poll.totalVotes

/** A question the creator has answered and published. */
export type AnsweredQuestion = {
  id: string
  question: string
  answer: string
  answeredAt: Date
}

export const toAnsweredQuestion = (row: Tables<'com_ask_questions'>): AnsweredQuestion => ({
  id: row.id,
  question: row.body,
  answer: row.answer!,
  answeredAt: new Date(row.answered_at!),
})
