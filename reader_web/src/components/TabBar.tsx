import { NavLink } from 'react-router'
import { TABS, TabIcon } from './nav'

/**
 * The bottom tab bar from ReaderTabs.dc.html: five destinations, stroke icons,
 * terracotta for the active tab. It is the phone's navigation only — on a wide
 * screen the sidebar in `nav.tsx` takes over, because a bar pinned to the
 * bottom edge of a monitor is a phone idiom stretched across a desk.
 */
export function TabBar() {
  return (
    // `lg:hidden` belongs here rather than on a wrapper: `position: sticky` is
    // constrained by its parent block, so a wrapper div only as tall as the bar
    // leaves it nowhere to stick and it simply scrolls away with the page.
    <nav className="sticky bottom-0 z-10 flex border-t border-line bg-surface/95 px-2 pt-[10px] backdrop-blur-sm pb-[calc(10px+env(safe-area-inset-bottom,0px))] lg:hidden">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-1 flex-col items-center gap-[5px] py-1">
          {({ isActive }) => (
            <>
              <span className={isActive ? 'text-accent' : 'text-subtle'}>
                <TabIcon path={tab.path} active={isActive} />
              </span>
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
