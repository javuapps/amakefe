import { NavLink } from 'react-router'

/**
 * The four destinations, and the icon each one draws.
 *
 * Shared by the phone's bottom bar and the desktop sidebar, because they are
 * the same navigation in two shapes — two copies would be two lists that agree
 * until a tab is added. "Share Your Story" is deliberately absent: it is a call
 * to action, not a place, which is why it sits in the header instead.
 */
export const TABS = [
  { to: '/', label: 'Home', path: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5' },
  {
    to: '/stories',
    label: 'Stories',
    path: 'M4 4.5h7a2 2 0 0 1 2 2V20a2.2 2.2 0 0 0-2-1.5H4zM20 4.5h-7a2 2 0 0 0-2 2V20a2.2 2.2 0 0 1 2-1.5h7z',
  },
  {
    to: '/community',
    label: 'Community',
    path: 'M17 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1.5a4 4 0 0 0-3-3.8M16 3.7a4 4 0 0 1 0 7.6',
  },
  {
    to: '/profile',
    label: 'Profile',
    path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  },
] as const

export function TabIcon({ path, active }: { path: string; active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}

/**
 * The desktop navigation, in the top bar.
 *
 * Laid out the way Facebook's is, because that is where this audience comes
 * from and it is the shape they already know: the destinations sit in the
 * middle of the bar, each an icon over nothing at all, and the active one is
 * marked by a rule under it rather than by a filled pill. Hidden on a phone,
 * where the bottom bar does this job.
 */
export function TopNav() {
  return (
    <nav className="flex h-full items-stretch gap-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          title={tab.label}
          className={({ isActive }) =>
            `group relative flex w-[92px] items-center justify-center transition-colors ${
              isActive ? 'text-accent' : 'text-subtle hover:text-body'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex flex-col items-center gap-[3px]">
                <TabIcon path={tab.path} active={isActive} />
                <span className="text-[11px] tracking-[0.02em]">{tab.label}</span>
              </span>
              {/* The active marker is a rule on the bar's own bottom edge, not
                  a box around the link — it belongs to the bar. */}
              <span
                className={`absolute inset-x-2 bottom-0 h-[2.5px] rounded-t ${
                  isActive ? 'bg-accent' : 'bg-transparent'
                }`}
                aria-hidden
              />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
