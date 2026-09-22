import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'

import './styles.css'
import { AuthProvider } from './auth'
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

function Shell() {
  return (
    // The reader is a phone-width column, centred on anything wider.
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-surface">
      <main className="flex-1">
        <Outlet />
      </main>
      <TabBar />
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
