import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { EventPlanningPage } from '../pages/EventPlanningPage'
import { EventPlanDetailPage } from '../pages/EventPlanDetailPage'
import { EventPlanningProvider } from '../context/EventPlanningProvider'
import {
  MockEventPlanningAuthProvider,
  MockEventPlanningDataProvider,
  createAcPlanningAuthProvider,
} from '../api/mockPlanningAdapter'

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: async () => ({
    id: 'mem-kalena',
    email: 'kalena@l2hub.local',
    full_name: 'Kalena Dai',
    role: 'member',
    permissions: [
      'planning.view',
      'planning.create',
      'planning.assign',
      'knowledge.view',
    ],
  }),
  hasPermission: (
    user: { permissions?: string[] },
    key: string,
  ) => Boolean(user.permissions?.includes(key)),
}))

vi.mock('../../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function renderPlanning(
  ui: ReactElement,
  options?: {
    auth?: MockEventPlanningAuthProvider
    route?: string
    path?: string
  },
) {
  const dataProvider = new MockEventPlanningDataProvider()
  const authProvider = options?.auth ?? new MockEventPlanningAuthProvider()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const route = options?.route ?? '/event-planning'
  const path = options?.path ?? '/event-planning'

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EventPlanningProvider
          dataProvider={dataProvider}
          authProvider={authProvider}
        >
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={children} />
              <Route path="/event-planning/:planId" element={children} />
              <Route path="/event-planning" element={children} />
            </Routes>
          </MemoryRouter>
        </EventPlanningProvider>
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper })
}

describe('EventPlanningPage', () => {
  it('lists plans and exposes knowledge assist', async () => {
    renderPlanning(<EventPlanningPage />)
    expect(await screen.findByText('Event planning')).toBeInTheDocument()
    expect(screen.getByText('Maze Day 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Agenda knowledge assist' }),
    ).toBeInTheDocument()
  })

  it('creates a new plan', async () => {
    const user = userEvent.setup()
    renderPlanning(<EventPlanningPage />)
    await screen.findByText('Start a plan')
    await user.type(screen.getByPlaceholderText('Event title'), 'Club Fair')
    await user.type(
      screen.getByPlaceholderText(/What is this event/),
      'Tables in the quad',
    )
    await user.click(screen.getByRole('button', { name: 'Create plan' }))
    await waitFor(() => {
      expect(screen.getByText('Club Fair')).toBeInTheDocument()
    })
  })
})

describe('EventPlanDetailPage', () => {
  it('lets AC enable a pending plan', async () => {
    const user = userEvent.setup()
    renderPlanning(<EventPlanDetailPage />, {
      auth: createAcPlanningAuthProvider(),
      route: '/event-planning/plan-maze',
      path: '/event-planning/:planId',
    })
    expect(await screen.findByText('Awaiting Mr. Jan')).toBeInTheDocument()
    await user.click(screen.getByTestId('enable-plan-button'))
    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })
  })
})
