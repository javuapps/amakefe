import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'

import './styles.css'
import { AuthProvider, NoAccess, SignIn, useAuth } from './auth'
import { Shell } from './components/shell'
import { DashboardScreen } from './screens/DashboardScreen'

/**
 * The studio shows drafts, which change as the creator works,
 * so nothing is held stale for long and a refocused window refetches — the
 * opposite of the reader app, which is tuned for scarce mobile data.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <DashboardScreen /> },
      {
        path: '/stories',
        lazy: async () => ({ Component: (await import('./screens/StoriesScreen')).StoriesScreen }),
      },
      {
        path: '/stories/:storyId',
        lazy: async () => ({
          Component: (await import('./screens/StoryDetailScreen')).StoryDetailScreen,
        }),
      },
      {
        path: '/stories/:storyId/parts/:partId',
        lazy: async () => ({
          Component: (await import('./screens/PartDetailScreen')).PartDetailScreen,
        }),
      },
      {
        path: '/schedule',
        lazy: async () => ({ Component: (await import('./screens/ScheduleScreen')).ScheduleScreen }),
      },
      {
        path: '/settings',
        lazy: async () => ({ Component: (await import('./screens/SettingsScreen')).SettingsScreen }),
      },
      // One screen, three kinds — the frame is identical and only the middle
      // differs, so the kind is a prop rather than three near-copies.
      {
        path: '/community/questions',
        lazy: async () => {
          const { CommunityScreen } = await import('./screens/CommunityScreen')
          return { Component: () => <CommunityScreen kind="question" /> }
        },
      },
      {
        path: '/community/polls',
        lazy: async () => {
          const { CommunityScreen } = await import('./screens/CommunityScreen')
          return { Component: () => <CommunityScreen kind="poll" /> }
        },
      },
      {
        path: '/community/notices',
        lazy: async () => {
          const { CommunityScreen } = await import('./screens/CommunityScreen')
          return { Component: () => <CommunityScreen kind="notice" /> }
        },
      },
      {
        path: '/moderation',
        lazy: async () => ({
          Component: (await import('./screens/ModerationScreen')).ModerationScreen,
        }),
      },
      {
        path: '/supporters',
        lazy: async () => ({
          Component: (await import('./screens/SupportersScreen')).SupportersScreen,
        }),
      },
    ],
  },
])

function Studio() {
  const { session, isEditorial, loading, signOut } = useAuth()

  if (loading) {
    return <div className="min-h-dvh bg-ink" />
  }
  if (!session) return <SignIn />
  if (!isEditorial) return <NoAccess onSignOut={signOut} />

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Studio />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
