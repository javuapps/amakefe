import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The fade-and-rise something makes when it replaces what was there.
 *
 * Used for a screen on navigation and for a tab panel on a tab change — the
 * same gesture either way, which is the point: a reader should not have to
 * learn two vocabularies for "this is new".
 *
 * It restarts the animation rather than remounting anything. Keying a wrapper
 * on the trigger would tear down and rebuild the contents every time —
 * including on the changes that only move a parameter, like stepping through
 * the parts of a series, where the component is meant to stay put and keep its
 * state. Toggling a class costs nothing and changes no behaviour.
 *
 * `trigger` is passed in rather than read from a router: this package has no
 * router dependency and should not gain one to animate a div.
 */
export function Appear({ trigger, children }: { trigger: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.classList.remove('page-enter')
    // Removing and re-adding a class in one tick is coalesced into no change at
    // all, so the animation never restarts. Reading a layout property forces
    // the reflow that makes the browser notice both halves.
    void element.offsetWidth
    element.classList.add('page-enter')
  }, [trigger])

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  )
}
