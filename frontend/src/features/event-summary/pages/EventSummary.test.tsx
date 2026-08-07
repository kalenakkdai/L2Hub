import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../../../test/supabaseMock'
import { renderWithProviders } from '../../../test/renderWithProviders'

vi.mock('../../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../../test/supabaseMock')>(
      '../../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../../lib/supabase')
const { EventsPage } = await import('./EventsPage')
const { EventSummaryPage } = await import('./EventSummaryPage')
const { WrappedPage } = await import('./WrappedPage')

const mock = supabase as unknown as SupabaseMock

function mockApiByUrl(handlers: Record<string, { status?: number; body: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const match = Object.entries(handlers)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => url.includes(path))
    if (!match) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: `No mock for ${url}` }),
      } as Response
    }
    const [, entry] = match
    const status = entry.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => entry.body,
    } as Response
  })
}

const AC_ME = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ac@l2hub.local',
  full_name: 'Mr. Jan',
  role: 'ac',
  created_at: '2026-01-01T00:00:00Z',
  permissions: [
    'events.view',
    'wrapped.request',
    'wrapped.approve',
    'wrapped.generate',
    'wrapped.publish',
    'wrapped.view_published',
    'wrapped.view_all',
    'notifications.view_own',
  ],
}

const ASBO_ME = {
  ...AC_ME,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'asbo@l2hub.local',
  full_name: 'Taylor Kim',
  role: 'asbo',
  permissions: ['events.view', 'wrapped.request', 'notifications.view_own'],
}

const MEMBER_ME = {
  ...AC_ME,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  email: 'member@l2hub.local',
  full_name: 'Member One',
  role: 'member',
  permissions: ['events.view', 'wrapped.view_published'],
}

function renderAt(path: string, route: string, element: React.ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={element} />
    </Routes>,
    { route },
  )
}

describe('Event Summary workflow UI', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('lists events with status badges', async () => {
    mockApiByUrl({
      '/auth/me': { body: AC_ME },
      '/events': {
        body: {
          events: [
            {
              id: '1',
              name: 'Maze Day',
              slug: 'maze-day-2026',
              year: 2026,
              eventStatus: 'complete',
              summaryStatus: 'not_requested',
              managingCommitteeId: null,
            },
          ],
        },
      },
    })

    renderWithProviders(<EventsPage />)

    expect(await screen.findByText('Maze Day 2026')).toBeInTheDocument()
    expect(screen.getByText('Not Requested')).toBeInTheDocument()
  })

  it('shows approve controls for AC on pending requests', async () => {
    mockApiByUrl({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026': {
        body: {
          id: '1',
          name: 'Maze Day',
          slug: 'maze-day-2026',
          year: 2026,
          eventStatus: 'complete',
          summaryStatus: 'pending_approval',
          managingCommitteeId: null,
          canRequest: true,
          canApprove: true,
          canGenerate: true,
          canPublish: true,
        },
      },
    })

    renderAt(
      '/events/:eventId/summary',
      '/events/maze-day-2026/summary',
      <EventSummaryPage />,
    )

    expect(await screen.findByRole('button', { name: /Approve/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('hides approve controls for ASBO', async () => {
    mockApiByUrl({
      '/auth/me': { body: ASBO_ME },
      '/events/maze-day-2026': {
        body: {
          id: '1',
          name: 'Maze Day',
          slug: 'maze-day-2026',
          year: 2026,
          eventStatus: 'complete',
          summaryStatus: 'pending_approval',
          managingCommitteeId: null,
          canRequest: true,
          canApprove: false,
          canGenerate: false,
          canPublish: false,
        },
      },
    })

    renderAt(
      '/events/:eventId/summary',
      '/events/maze-day-2026/summary',
      <EventSummaryPage />,
    )

    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })

  it('shows unauthorized for draft Wrapped for members', async () => {
    mockApiByUrl({
      '/auth/me': { body: MEMBER_ME },
      '/events/maze-day-2026/wrapped': {
        status: 403,
        body: { detail: 'denied' },
      },
    })

    renderAt(
      '/events/:eventId/wrapped',
      '/events/maze-day-2026/wrapped',
      <WrappedPage />,
    )

    expect(await screen.findByText('Unauthorized')).toBeInTheDocument()
  })

  it('navigates Wrapped stories and labels anonymous contributors', async () => {
    const user = userEvent.setup()
    mockApiByUrl({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/wrapped': {
        body: {
          event: {
            id: '1',
            name: 'Maze Day',
            slug: 'maze-day-2026',
            year: 2026,
            eventStatus: 'complete',
            summaryStatus: 'generated',
            managingCommitteeId: null,
          },
          status: 'generated',
          wrapped: {
            hero: {
              title: 'Maze Day 2026',
              contributors: 48,
              submissionRate: 96,
              tagline: "Let's look back.",
            },
            overallRating: { score: 4.82, max: 5 },
            committeeRankings: [],
            participation: {
              invited: 50,
              submitted: 48,
              absent: 2,
              completionPercent: 96,
            },
            timeline: { medianSeconds: 78, firstMinutePercent: 50, bubbles: [] },
            topStrengths: [],
            topImprovements: [],
            materialRequests: [],
            committeeBreakdown: [],
            historicalComparison: {
              previousEvent: 'Maze Day 2025',
              ratingDeltaPercent: 12,
              parkingComplaintDeltaPercent: -40,
              repeatedIssues: [],
              resolvedIssues: [],
            },
            executiveSummary: {
              summary: 'Summary text',
              successes: [],
              recommendedActions: [],
            },
          },
          graph: {
            nodes: [
              {
                id: 'earlier_setup',
                label: 'Earlier Setup',
                mentions: 31,
                kind: 'improvement',
              },
            ],
            edges: [],
            themes: [
              {
                id: 'earlier_setup',
                label: 'Earlier Setup',
                mentions: 31,
                kind: 'improvement',
                summary: 'Setup started late.',
                contributors: [
                  {
                    name: null,
                    committee: null,
                    quote: 'We needed more time.',
                    anonymous: true,
                  },
                ],
              },
            ],
          },
          executiveSummary: {
            summary: 'Summary text',
            successes: [],
            recommendedActions: [],
          },
        },
      },
    })

    renderAt(
      '/events/:eventId/wrapped',
      '/events/maze-day-2026/wrapped',
      <WrappedPage />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Maze Day 2026' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'List view' }))
    expect(await screen.findByText('Feedback Constellation')).toBeInTheDocument()
    expect(screen.getByText('Anonymous contributor')).toBeInTheDocument()
  })

  it('ASBO can request generation from events list', async () => {
    const user = userEvent.setup()
    mockApiByUrl({
      '/auth/me': { body: ASBO_ME },
      '/events': {
        body: {
          events: [
            {
              id: '1',
              name: 'Maze Day',
              slug: 'maze-day-2026',
              year: 2026,
              eventStatus: 'complete',
              summaryStatus: 'not_requested',
              managingCommitteeId: null,
            },
          ],
        },
      },
      '/events/maze-day-2026/summary/request': {
        body: { id: 'r1', status: 'pending', summaryStatus: 'pending_approval' },
      },
    })

    renderWithProviders(<EventsPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Generate Event Summary' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Generate Event Summary' }),
      ).toBeInTheDocument()
    })
  })
})
