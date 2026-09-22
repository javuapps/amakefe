import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth'

/**
 * The console wears the product's palette but not its portrait.
 *
 * `<Mark>` stands for the creator, and this is not her application — an
 * operator looking at a payout should be in no doubt whose side of the money
 * they are on.
 */
const TITLES: Record<string, [string, string]> = {
  '/': ['Collections', 'Every payment supporters have made'],
  '/settlements': ['Settlements', 'What is owed, and what has been paid'],
  '/account': ['Payout account', 'Where the creator is settled'],
}

export function Shell() {
  const { pathname } = useLocation()
  const { session, signOut } = useAuth()
  const [title, subtitle] = TITLES[pathname] ?? ['Operator console', '']
  const email = session?.user.email ?? ''

  return (
    <div className="flex h-dvh overflow-hidden bg-[#fbf7f0]">
      <aside className="on-ink flex w-[244px] shrink-0 flex-col overflow-y-auto bg-ink py-6">
        <div className="px-[22px] pb-[26px]">
          <div className="font-display text-[17px] leading-tight text-surface-warm">
            Mindful Moments
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#9c8878]">
            Operator console
          </div>
        </div>

        <nav className="flex flex-col gap-[2px] px-3">
          <Item to="/" glyph="◷" label="Collections" end />
          <Item to="/settlements" glyph="◧" label="Settlements" />
          <Item to="/account" glyph="❏" label="Payout account" />
        </nav>

        <div className="mt-auto flex items-center gap-[10px] px-[22px] pt-5">
          <div className="flex size-[30px] items-center justify-center rounded-full bg-accent text-sm text-[#fff6ea]">
            {email.charAt(0).toUpperCase() || '·'}
          </div>
          <button type="button" onClick={signOut} className="text-[14px] text-[#d9c7b6]">
            Sign out
          </button>
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

function Item({
  to,
  label,
  glyph,
  end = false,
}: {
  to: string
  label: string
  glyph: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-[11px] rounded-lg px-3 py-[11px] text-[15px] transition-colors ${
          isActive
            ? 'bg-surface-warm/12 text-surface-warm'
            : 'text-[#b5a294] hover:text-surface-warm'
        }`
      }
    >
      <span className="w-[22px] text-center text-[19px] leading-none opacity-90" aria-hidden>
        {glyph}
      </span>
      {label}
    </NavLink>
  )
}

/** Loading and error in one place, so no screen invents its own. */
export function Async<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <div className="h-32 animate-pulse rounded-card bg-surface-tint" />
  if (query.isError) {
    return (
      <p className="py-6 text-sm text-accent-deep">
        {query.error instanceof Error ? query.error.message : 'That did not load.'}
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

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border border-line-card bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 font-display text-[22px] text-ink">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  )
}
