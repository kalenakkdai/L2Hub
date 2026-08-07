import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'

type Options = {
  /** Initial history entries for the in-memory router. */
  route?: string
  /** Skip AuthProvider when a test supplies its own auth context. */
  withAuth?: boolean
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Retries turn a deterministic failure into a slow, flaky test.
      queries: { retry: false, gcTime: 0 },
    },
  })
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/', withAuth = true } = options
  const queryClient = makeQueryClient()

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
      </MemoryRouter>
    </QueryClientProvider>
  )

  return { queryClient, ...render(ui, { wrapper: Wrapper }) }
}
