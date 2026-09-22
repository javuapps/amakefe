import { Link } from 'react-router'
import { SUPPORT_AMOUNTS, canonicalPath, isSeries, resumePoint, type StoryCard } from '@amakefe/core'
import { Async, Pill, SectionLabel } from '../components/primitives'
import { StoryRow } from '../components/StoryRow'
import { Mark } from '../components/Mark'
import { PostCard } from '../components/PostCard'
import {
  useCommunityFeed,
  useContinueReading,
  useLatestStories,
} from '../hooks/queries'

export function HomeScreen() {
  const latest = useLatestStories()

  return (
    // From `lg` the column is capped and centred: the prose below runs to a
    // readable measure instead of the full width of a monitor.
    <div className="flex flex-col pb-7 lg:mx-auto lg:w-full lg:max-w-[900px] lg:px-6 lg:pb-12">
      <Greeting />

      <div className="px-5 lg:px-0">
        <Async query={latest} loading={<div className="h-[196px] animate-pulse rounded-card bg-surface-tint" />}>
          {(stories) => (stories[0] ? <ReadingCard fallback={stories[0]} /> : null)}
        </Async>
      </div>

      <div className="mt-[26px] flex items-baseline justify-between px-5 lg:px-0">
        <h2 className="font-display text-[19px] text-ink">Latest stories</h2>
        <Link to="/stories" className="text-xs text-accent">
          See all
        </Link>
      </div>

      {/* Two columns here and a single list on /stories, which is not an
          inconsistency: Home shows a handful as a taste, where a pair of short
          columns fills the width without becoming a wall. The Stories page is
          the list you scroll, and two columns of it read as two separate
          lists. */}
      <div className="px-5 pt-3 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:px-0">
        <Async query={latest}>
          {(stories) => (
            <>
              {stories.slice(0, 4).map((story, index) => (
                // The prototype's Home lists three. The fourth exists only to
                // square off the two desktop columns, so the phone never sees
                // it.
                <div key={story.id} className={index === 3 ? 'hidden lg:block' : undefined}>
                  <StoryRow story={story} />
                </div>
              ))}
            </>
          )}
        </Async>
      </div>

      <LatestFromCommunity />
      <SupportCard />
      <ShareCta />
    </div>
  )
}

function Greeting() {
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <header className="flex items-center gap-[11px] px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-3 lg:px-0 lg:pt-7 lg:pb-5">
      {/* The sidebar already carries the mark and the name on desktop; a second
          set beside the greeting is the same thing said twice. */}
      <span className="lg:hidden">
        <Mark size={38} />
      </span>
      <div>
        {/* Readers are anonymous, so there is no name to greet — the time of day
            stands on its own. */}
        <div className="text-[13px] text-muted">{timeOfDay}</div>
        <div className="font-display text-[17px] leading-none text-ink">Mindful Moments</div>
      </div>
    </header>
  )
}

/**
 * The dark card at the top of Home. It shows the story the reader is part-way
 * through, or — for a first-time reader, the common case in a community arriving
 * from Facebook — the newest story instead.
 */
function ReadingCard({ fallback }: { fallback: StoryCard }) {
  const inProgress = useContinueReading()
  const resumed = inProgress.data?.[0]
  const story = resumed?.story ?? fallback
  const { nextPart, progress, resuming } = resumePoint(story, resumed?.lastPart ?? null)

  return (
    <article className="rounded-card bg-ink p-5 pt-[18px]">
      <SectionLabel tone="gold">{resuming ? 'Continue reading' : 'Start here'}</SectionLabel>
      <h2 className="mt-3 font-display text-[27px] leading-[1.15] text-surface-warm">
        {story.title}
      </h2>
      <p className="mt-3 text-xs text-[#c9b6a4]">
        {story.categoryName} ·{' '}
        {isSeries(story) ? `Part ${nextPart} of ${story.totalPartCount}` : `${story.readMinutes} min read`}
      </p>

      {isSeries(story) && (
        <div className="mt-3 h-1 overflow-hidden rounded bg-surface-warm/20">
          <div
            className="h-full rounded bg-gold transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      <Link
        to={canonicalPath(story.slug, { part: nextPart, isSeries: isSeries(story) })}
        className="mt-4 inline-block"
      >
        <Pill variant="gold">{resuming ? `Continue Part ${nextPart}` : 'Start reading'}</Pill>
      </Link>
    </article>
  )
}

/**
 * The newest thing from the community, whatever kind it is.
 *
 * Home used to fetch a question and a poll separately and show both. There is
 * one timeline now, so this takes the top of it — and a notice or an answered
 * question is as likely to be worth seeing as a poll.
 */
function LatestFromCommunity() {
  const feed = useCommunityFeed()
  const post = feed.data?.pages[0]?.items[0]
  if (!post) return null

  return (
    <section className="px-5 pt-6 lg:px-0 lg:pt-10">
      <PostCard post={post} />
    </section>
  )
}

function SupportCard() {
  return (
    <section className="px-5 pt-4 lg:px-0">
      {/* `?from=` is how the asks that link rather than open the sheet still
          get the credit for what someone gives once they arrive. */}
      <Link
        to="/support?from=home_card"
        className="block rounded-card bg-accent p-[18px] text-[#fff6ea] lg:p-6"
      >
        <h3 className="font-display text-[19px]">Support the Community</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#ffebd8]">
          If these stories have helped you, you can support the work behind them.
        </p>
        <div className="mt-3 flex gap-2">
          {SUPPORT_AMOUNTS.slice(0, 3).map((amount) => (
            <span
              key={amount}
              className="rounded-full bg-white/18 px-[14px] py-[7px] text-[13px] font-semibold"
            >
              ZMW {amount}
            </span>
          ))}
        </div>
      </Link>
    </section>
  )
}

/**
 * The full-width button that closes Home in the prototype.
 *
 * Hidden from `lg`, where the same call to action is a permanent button in the
 * header — two of them on one screen is the app asking twice.
 */
function ShareCta() {
  return (
    <div className="px-5 pt-[18px] lg:hidden">
      <Link
        to="/share"
        className="block w-full rounded-full bg-ink py-[15px] text-center text-[15px] font-semibold text-surface-warm"
      >
        Share your story
      </Link>
    </div>
  )
}
