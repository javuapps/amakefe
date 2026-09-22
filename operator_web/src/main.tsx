import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'

import './styles.css'
import { AuthProvider, NoAccess, SignIn, useAuth } from './auth'
import { Shell } from './components/shell'
import { CollectionsScreen } from './screens/CollectionsScreen'

/**
 * Money in flight changes without this app doing anything — a webhook or the
 * reconciler settles a payment while the screen is open — so nothing is held
 * stale for long and a refocused window refetches.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10 * 1000, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <CollectionsScreen /> },
      {
        path: '/settlements',
        lazy: async () => ({
          Component: (await import('./screens/SettlementsScreen')).SettlementsScreen,
        }),
      },
      {
        path: '/account',
        lazy: async () => ({
          Component: (await import('./screens/AccountScreen')).AccountScreen,
        }),
      },
    ],
  },
])

function Console() {
  const { session, isOperator, loading, signOut } = useAuth()

  if (loading) return <div className="min-h-dvh bg-ink" />
  if (!session) return <SignIn />
  if (!isOperator) return <NoAccess onSignOut={signOut} />

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Console />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
