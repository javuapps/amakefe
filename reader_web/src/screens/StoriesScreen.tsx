import { useEffect, useRef, useState } from 'react'
import { Async } from '../components/primitives'
import { StoryRow } from '../components/StoryRow'
import { useCategories, useStoryList } from '../hooks/queries'

export function StoriesScreen() {
  const [category, setCategory] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const categories = useCategories()
  const stories = useStoryList(category, term)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = stories

  // A marker at the end of the list rather than a scroll listener: it fires
  // once per crossing and does not care what is doing the scrolling.
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      // A screenful early, so the next page has usually arrived by the time the
      // reader reaches it.
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <div className="flex flex-col pb-6">
      <div className="px-5 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <h1 className="font-display text-[26px] text-ink">Stories</h1>
      </div>

      {/* Search and the category chips pin to the top; the title scrolls away
       *  above them. Full-bleed background with matching padding, so the page
       *  does not show through at the edges as rows slide underneath. */}
      <div className="sticky top-0 z-10 bg-surface/95 px-5 pt-[10px] pb-2 backdrop-blur-sm">
        <div className="relative">
          <svg
            className="absolute top-1/2 left-4 -translate-y-1/2 text-subtle"
            width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search stories"
            aria-label="Search stories"
            className="w-full rounded-full border border-line bg-surface-raised py-[11px] pr-10 pl-11 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-4 -translate-y-1/2 text-subtle"
            >
              ✕
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-5 mt-[12px] flex gap-2 overflow-x-auto px-5 pb-1">
          {[{ slug: null, name: 'All' }, ...(categories.data ?? [])].map((item) => {
            const active = category === item.slug
            return (
              <button
                key={item.slug ?? 'all'}
                type="button"
                onClick={() => setCategory(item.slug)}
                className={`shrink-0 rounded-full border px-[14px] py-[7px] text-[13px] transition-colors ${
                  active
                    ? 'border-ink bg-ink text-surface-warm'
                    : 'border-line-card text-body hover:border-line-strong'
                }`}
              >
                {item.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-5 pt-1">
        <Async query={stories}>
          {(data) => {
            const list = data.pages.flatMap((page) => page.items)
            return list.length === 0 ? (
              <p className="py-10 text-sm text-muted">
                {term.trim().length >= 2
                  ? `Nothing matches “${term.trim()}” yet.`
                  : 'No stories here yet.'}
              </p>
            ) : (
              <>
                {list.map((story) => (
                  <StoryRow key={story.id} story={story} />
                ))}
                <div ref={sentinel} aria-hidden />
                {stories.isFetchingNextPage && (
                  <p className="py-4 text-center text-xs text-muted">Loading more…</p>
                )}
              </>
            )
          }}
        </Async>
      </div>
    </div>
  )
}
