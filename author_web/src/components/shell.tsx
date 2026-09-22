import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { useStudioTotals } from '../hooks/queries'
import { Mark } from './Mark'
import { ConfirmProvider } from './ConfirmDialog'
import { NewStoryProvider, useNewStory } from './NewStoryDialog'

/**
 * Stories are a section, not a page: the list, starting a new one and the
 * release calendar are three ways into the same work.
 */
const STORY_ROUTES = ['/stories', '/schedule']

const TITLES: Record<string, [string, string]> = {
  '/': ['Dashboard', 'How the community is reading'],
  '/stories': ['All stories', 'Every story and the parts inside it'],
  '/schedule': ['Schedule & publish', 'What goes out, and when'],
  '/community/questions': ['Ask Her', 'Questions readers have sent, and your answers'],
  '/community/polls': ['Polls', 'What the community is being asked'],
  '/community/notices': ['Notices', 'Short posts to the community'],
  '/moderation': ['Moderation', 'Comments and reports waiting for you'],
  '/settings': ['Settings', 'Where the studio publishes to'],
  '/supporters': ['Supporters & revenue', 'Contributions to the community'],
}

/** A story's own page and a part's; both name themselves in their heading. */
const titleFor = (pathname: string): [string, string] => {
  if (/^\/stories\/[^/]+\/parts\/[^/]+$/.test(pathname)) {
    return ['Part', 'What it says, how it is doing, and what to do with it']
  }
  if (/^\/stories\/[^/]+$/.test(pathname)) {
    return ['Story', 'Its details, and the parts inside it']
  }
  return TITLES[pathname] ?? ['Studio', '']
}

export function Shell() {
  return (
    <ConfirmProvider>
      <NewStoryProvider>
        <ShellFrame />
      </NewStoryProvider>
    </ConfirmProvider>
  )
}

function ShellFrame() {
  const { pathname } = useLocation()
  const { session, signOut } = useAuth()
  const [title, subtitle] = titleFor(pathname)
  const email = session?.user.email ?? ''

  return (
    // The shell is exactly one viewport tall and does not scroll. Only the
    // content column does, so the sidebar and the page header stay put however
    // long the list of stories gets.
    <div className="flex h-dvh overflow-hidden bg-[#fbf7f0]">
      <aside className="on-ink flex w-[244px] shrink-0 flex-col overflow-y-auto bg-ink py-6">
        <div className="flex items-center gap-[11px] px-[22px] pb-[26px]">
          <Mark size={38} />
          <div>
            <div className="font-display text-[17px] leading-tight text-surface-warm">
              Mindful Moments
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#9c8878]">
              Creator studio
            </div>
          </div>
        </div>

        <Nav />

        <div className="mt-auto flex flex-col gap-[14px] px-[22px] pt-5">
          <InboxSummary />
          <div className="flex items-center gap-[10px] pt-[6px]">
            <div className="flex size-[30px] items-center justify-center rounded-full bg-accent text-sm text-[#fff6ea]">
              {email.charAt(0).toUpperCase() || '·'}
            </div>
            <button type="button" onClick={signOut} className="text-[14px] text-[#d9c7b6]">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-[#fbf7f0] px-8 py-[22px]">
          <div>
            <h1 className="font-display text-[23px] leading-tight text-ink">{title}</h1>
            <p className="mt-[3px] text-[13px] text-muted">{subtitle}</p>
          </div>
          <p className="text-xs text-muted">{email}</p>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Nav() {
  const { pathname } = useLocation()
  const openNewStory = useNewStory()
  const inStories = STORY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
  const inCommunity = pathname.startsWith('/community')

  return (
    <nav className="flex flex-col gap-[2px] px-3">
      <Item to="/" glyph="◧" label="Dashboard" end />

      {/* The group header is a landmark rather than a link — its three children
          are the destinations, and one of them is not a page at all. */}
      <div
        className={`mt-1 flex items-center gap-[11px] px-3 py-[11px] text-[15px] ${
          inStories ? 'text-surface-warm' : 'text-[#b5a294]'
        }`}
      >
        <span className="w-[22px] text-center text-[19px] leading-none opacity-90">❏</span>
        Stories
      </div>
      <div className="flex flex-col gap-[2px] pl-[22px]">
        <Item to="/stories" label="All stories" />
        <button
          type="button"
          onClick={openNewStory}
          className="flex items-center gap-[11px] rounded-lg px-3 py-[9px] text-left text-[14px] text-[#b5a294] transition-colors hover:text-surface-warm"
        >
          <span className="w-[14px] text-center text-[17px] leading-none opacity-90">+</span>
          New story
        </button>
        <Item to="/schedule" label="Schedule" />
      </div>

      {/* Same shape as Stories above: a landmark with its destinations under
          it, because the three are one job seen three ways. */}
      <div
        className={`mt-1 flex items-center gap-[11px] px-3 py-[11px] text-[15px] ${
          inCommunity ? 'text-surface-warm' : 'text-[#b5a294]'
        }`}
      >
        <span className="w-[22px] text-center text-[19px] leading-none opacity-90">☷</span>
        Community
      </div>
      <div className="flex flex-col gap-[2px] pl-[22px]">
        <Item to="/community/questions" label="Ask Her" />
        <Item to="/community/polls" label="Polls" />
        <Item to="/community/notices" label="Notices" />
      </div>

      <Item to="/moderation" glyph="⚑" label="Moderation" className="mt-1" />
      <Item to="/supporters" glyph="♥" label="Supporters" />
      <Item to="/settings" glyph="⚙" label="Settings" />
    </nav>
  )
}

function Item({
  to,
  label,
  glyph,
  end = false,
  className = '',
}: {
  to: string
  label: string
  /** Top-level items carry the prototype's unicode glyph; children are indented instead. */
  glyph?: string
  end?: boolean
  className?: string
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-[11px] rounded-lg px-3 transition-colors ${className} ${
          glyph ? 'py-[11px] text-[15px]' : 'py-[9px] text-[14px]'
        } ${
          isActive ? 'bg-surface-warm/12 text-surface-warm' : 'text-[#b5a294] hover:text-surface-warm'
        }`
      }
    >
      {/* The prototype's glyphs are unicode, not an icon set — they read thin
          next to the label, so they sit a size above it. */}
      <span
        className={`text-center leading-none opacity-90 ${
          glyph ? 'w-[22px] text-[19px]' : 'w-[14px] text-[17px]'
        }`}
        aria-hidden
      >
        {glyph ?? '·'}
      </span>
      {label}
    </NavLink>
  )
}

/**
 * The prototype shows "7 conversations waiting to become stories" here. That is
 * the Story Inbox from spec §40, which is not built — so the panel reports what
 * the week actually produced instead of a number nothing generates.
 *
 * Reads, not readers: `weeklyReaders` counts rows in usr_read_progress, which
 * only exist for someone who saved or reacted, so it sat at zero while people
 * were reading. `cnt_story_views` counts the reading itself, and knows nothing
 * about who did it.
 */
function InboxSummary() {
  const totals = useStudioTotals()
  const reads = totals.data?.views7d ?? 0

  return (
    <div className="flex flex-col gap-[5px] border-t border-surface-warm/15 pt-[18px]">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#9c8878]">This week</div>
      <div className="font-display text-[26px] text-gold">{reads.toLocaleString('en-GB')}</div>
      <div className="text-[13px] leading-relaxed text-[#c9b6a4]">
        {reads === 1 ? 'read' : 'reads'} of a story
      </div>
    </div>
  )
}

/**
 * Going back up a level.
 *
 * It used to be muted 12px text, which is how it got missed — people reached for
 * the browser's back button instead. It is a button-shaped thing now, in the
 * same vocabulary as the studio's other secondary actions, so it reads as
 * somewhere to click rather than as a caption above the title.
 */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-4 py-1.5 text-xs text-body transition-colors hover:border-accent hover:text-accent-deep"
    >
      <span aria-hidden className="text-[13px] leading-none">
        ←
      </span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

/** Shared loading and error handling, matching the reader app's `Async`. */
export function Async<T>({
  query,
  children,
  loading,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  loading?: ReactNode
}) {
  if (query.isPending) {
    return <>{loading ?? <div className="h-32 animate-pulse rounded-card bg-surface-tint" />}</>
  }
  if (query.isError) {
    return (
      <p className="py-6 text-sm text-accent-deep">
        {query.error instanceof Error ? query.error.message : 'Something went wrong.'}
      </p>
    )
  }
  return <>{children(query.data)}</>
}

export function Panel({
  title,
  children,
  actions,
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="rounded-card border border-line-card bg-surface p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-baseline justify-between">
          {title && <h2 className="font-display text-[19px] text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
