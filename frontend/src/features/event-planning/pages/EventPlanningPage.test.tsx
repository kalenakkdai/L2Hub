import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { EventPlanningPage } from '../pages/EventPlanningPage'
import { EventPlanDetailPage } from '../pages/EventPlanDetailPage'
import { EventPlanningProvider } from '../context/EventPlanningProvider'
import {
  MockEventPlanningAuthProvider,
  MockEventPlanningDataProvider,
  createAcPlanningAuthProvider,
} from '../api/mockPlanningAdapter'

const promoteApprovedPlan = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'promoted-event',
    name: 'Maze Day',
    slug: 'event-plan-maze',
    year: 2026,
    eventStatus: 'active',
    startsAt: '2026-10-18T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    summaryStatus: 'not_requested',
    managingCommitteeId: null,
    wrappedPresentedAt: null,
  })),
)

vi.mock('../../event-summary/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../event-summary/api')>()),
  promoteApprovedPlan,
}))

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

function renderPlanningApp(options?: {
  auth?: MockEventPlanningAuthProvider
  route?: string
}) {
  const dataProvider = new MockEventPlanningDataProvider()
  const authProvider = options?.auth ?? new MockEventPlanningAuthProvider()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const route = options?.route ?? '/event-planning'

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EventPlanningProvider
          dataProvider={dataProvider}
          authProvider={authProvider}
        >
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </EventPlanningProvider>
      </QueryClientProvider>
    )
  }

  return render(
    <Routes>
      <Route path="/event-planning" element={<EventPlanningPage />} />
      <Route path="/event-planning/:planId" element={<EventPlanDetailPage />} />
    </Routes>,
    { wrapper: Wrapper },
  )
}

describe('EventPlanningPage', () => {
  it('lists plans and exposes knowledge assist', async () => {
    renderPlanningApp()
    expect(await screen.findByText('Event planning')).toBeInTheDocument()
    expect(screen.getByText('Maze Day 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Agenda knowledge assist' }),
    ).toBeInTheDocument()
  })

  it('creates a plan and opens the auto-generated Winter Ball–style agenda', async () => {
    const user = userEvent.setup()
    renderPlanningApp()
    await screen.findByText('Start a plan')
    await user.type(screen.getByPlaceholderText('Event title'), 'Club Fair')
    await user.type(
      screen.getByPlaceholderText(/What is this event/),
      'Tables in the quad',
    )
    await user.click(screen.getByRole('button', { name: 'Create plan' }))

    expect(
      await screen.findByRole('article', { name: 'Plan agenda' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Club Fair Meeting Agenda for / }),
    ).toBeInTheDocument()
    expect(screen.getByText('MISSION SAN JOSE HIGH SCHOOL')).toBeInTheDocument()
    expect(screen.getByText(/Draft from Winter Ball planning agenda/)).toBeInTheDocument()
    expect(screen.getByText('I. Attendees')).toBeInTheDocument()
    expect(screen.getByText('II. To-do before meeting')).toBeInTheDocument()
    expect(screen.getByText('III. Agenda / Meeting Notes')).toBeInTheDocument()
  })
})

describe('EventPlanDetailPage', () => {
  it('lets AC enable a pending plan', async () => {
    const user = userEvent.setup()
    renderPlanningApp({
      auth: createAcPlanningAuthProvider(),
      route: '/event-planning/plan-maze',
    })
    expect(await screen.findByText('Awaiting Mr. Jan')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Plan agenda' })).toBeInTheDocument()
    await user.click(screen.getByTestId('enable-plan-button'))
    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })
    expect(promoteApprovedPlan).toHaveBeenCalledWith({
      planId: 'plan-maze',
      title: 'Maze Day 2026',
      eventDate: '2026-10-18',
    })
  })
})
