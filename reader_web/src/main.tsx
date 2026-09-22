import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useLocation,
} from 'react-router'

import { Link } from 'react-router'
import { Appear } from '@amakefe/ui'
import './styles.css'
import { AuthProvider } from './auth'
import { Mark } from './components/Mark'
import { TopNav } from './components/nav'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'

/**
 * Content changes a few times a week, and the audience is on intermittent mobile
 * data — so cached data stays fresh for a while and is never refetched just
 * because a window regained focus.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/**
 * When a screen throws.
 *
 * Without this react-router shows its own developer page — a stack trace and a
 * note addressed to whoever built the app — which is not something to put in
 * front of someone reading about their marriage. Reloading is the honest
 * remedy: the cache is in memory, so it clears with the page.
 */
function Crashed() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-[24px] leading-snug text-ink">Something went wrong</h1>
      <p className="prose-story text-[15px] text-body">
        That is on us, not on you. Reloading usually sorts it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mx-auto rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface-warm"
      >
        Reload
      </button>
    </div>
  )
}

/**
 * Two layouts, one tree.
 *
 * **Phone** is the design in docs/screens, untouched: a 520px column with the
 * bottom tab bar, the page itself scrolling.
 *
 * **Desktop** is a top bar in three zones, the way Facebook's is — brand on the
 * left, the destinations in the middle, the one call to action on the right.
 * That is deliberate rather than generic: this audience arrives from Facebook
 * and already knows where to look. The prototypes do not draw a desktop view at
 * all, so this is a stated deviation, built in their vocabulary rather than as
 * a phone stretched across a monitor — where a bar pinned to the bottom edge of
 * a 27-inch screen is nobody's navigation.
 *
 * The breakpoint is `lg` (1024px). Tablets keep the phone layout: below that
 * the three zones cannot all fit without one of them becoming a puzzle.
 */
function Shell() {
  const { pathname } = useLocation()

  return (
    <div className="bg-surface lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <header className="hidden shrink-0 border-b border-line bg-surface lg:block">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-stretch justify-between gap-6 px-6">
          <Link to="/" className="flex shrink-0 items-center gap-[11px]">
            <Mark size={36} />
            <span className="font-display text-[17px] leading-tight text-ink">
              Mindful Moments
            </span>
          </Link>

          <TopNav />

          <div className="flex shrink-0 items-center">
            <Link
              to="/share"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#fff6ea]"
            >
              Share Your Story
            </Link>
          </div>
        </div>
      </header>

      {/* On a phone this whole div is the page and the window scrolls it; from
          `lg` it is the only scroll region, so the bar above stays put. */}
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col lg:min-h-0 lg:max-w-none lg:flex-1 lg:overflow-y-auto">
        <main className="flex-1">
          <Appear trigger={pathname}>
            <Outlet />
          </Appear>
        </main>
        <TabBar />
      </div>
      <ScrollRestoration />
    </div>
  )
}

/**
 * Only Home is in the initial bundle. The rest load when a tab is opened, which
 * keeps the first screen light on a slow connection — and the service worker has
 * precached the chunks by then anyway.
 */
const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <Crashed />,
    children: [
      { path: '/', element: <HomeScreen /> },
      {
        path: '/stories',
        lazy: async () => ({ Component: (await import('./screens/StoriesScreen')).StoriesScreen }),
      },
      // §75's shapes: a single-part story lives at /stories/<slug>; each part of
      // a series gets its own address so it can be shared and indexed alone.
      {
        path: '/stories/:slug',
        lazy: async () => ({ Component: (await import('./screens/StoryScreen')).StoryScreen }),
      },
      {
        path: '/stories/:slug/part-:part',
        lazy: async () => ({ Component: (await import('./screens/StoryScreen')).StoryScreen }),
      },
      {
        path: '/community',
        lazy: async () => ({ Component: (await import('./screens/CommunityScreen')).CommunityScreen }),
      },
      {
        path: '/support',
        lazy: async () => ({ Component: (await import('./screens/SupportScreen')).SupportScreen }),
      },
      {
        path: '/profile',
        lazy: async () => ({ Component: (await import('./screens/ProfileScreen')).ProfileScreen }),
      },
      // Meta will not let Facebook Login leave development without these, and
      // an app holding personal data needs a deletion route people can follow.
      {
        path: '/privacy',
        lazy: async () => ({ Component: (await import('./screens/PolicyScreens')).PrivacyScreen }),
      },
      {
        path: '/terms',
        lazy: async () => ({ Component: (await import('./screens/PolicyScreens')).TermsScreen }),
      },
      {
        path: '/data-deletion',
        lazy: async () => ({
          Component: (await import('./screens/PolicyScreens')).DataDeletionScreen,
        }),
      },
    ],
  },
  {
    // Share Your Story is a full-screen dark take-over with no tab bar, as the
    // prototype has it — it is a moment, not a destination.
    path: '/share',
    errorElement: <Crashed />,
    lazy: async () => ({ Component: (await import('./screens/ShareScreen')).ShareScreen }),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
