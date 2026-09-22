import { NavLink } from 'react-router'

/**
 * The bottom tab bar from ReaderTabs.dc.html: five destinations, stroke icons,
 * terracotta for the active tab. "Share Your Story" is deliberately not here —
 * it is a call to action, not a place.
 */
const TABS = [
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
]

export function TabBar() {
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-line bg-surface/95 px-2 pt-[10px] backdrop-blur-sm pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-1 flex-col items-center gap-[5px] py-1">
          {({ isActive }) => (
            <>
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? 2 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isActive ? 'text-accent' : 'text-subtle'}
              >
                <path d={tab.path} />
              </svg>
              <span
                className={`text-[10.5px] tracking-[0.04em] ${isActive ? 'text-accent' : 'text-subtle'}`}
              >
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
