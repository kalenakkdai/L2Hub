import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import {
  GradebookProvider,
  type GradebookAuthProvider,
  type GradebookCommandProvider,
  type GradebookDataProvider,
} from '../index'
import {
  MockGradebookAuthProvider,
  MockGradebookCommandProvider,
  MockGradebookDataProvider,
} from '../api/mockGradebookAdapter'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function renderWithGradebook(
  ui: ReactElement,
  options?: {
    dataProvider?: GradebookDataProvider
    commandProvider?: GradebookCommandProvider | null
    authProvider?: GradebookAuthProvider
    route?: string
    path?: string
  },
) {
  const dataProvider = options?.dataProvider ?? new MockGradebookDataProvider()
  const authProvider =
    options?.authProvider ?? new MockGradebookAuthProvider(['gradebook.view_own'])
  const commandProvider =
    options?.commandProvider === undefined
      ? new MockGradebookCommandProvider(dataProvider as MockGradebookDataProvider)
      : options.commandProvider
  const queryClient = createTestQueryClient()
  const route = options?.route ?? '/grades'
  const path = options?.path ?? '/grades'

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <GradebookProvider
          dataProvider={dataProvider}
          commandProvider={commandProvider}
          authProvider={authProvider}
        >
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={children} />
              <Route path="/grades/:assignmentId" element={children} />
              <Route path="/grades" element={children} />
            </Routes>
          </MemoryRouter>
        </GradebookProvider>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper }),
    dataProvider,
    authProvider,
    queryClient,
  }
}
