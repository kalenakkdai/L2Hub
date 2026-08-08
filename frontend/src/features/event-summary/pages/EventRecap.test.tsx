import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../../../test/supabaseMock'
import { renderWithProviders } from '../../../test/renderWithProviders'

vi.mock('../../../lib/supabase', async () => {
  const { createSupabaseMock } = await vi.importActual<
    typeof import('../../../test/supabaseMock')
  >('../../../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../../lib/supabase')
const { EventsPage } = await import('./EventsPage')
const { WrappedPage } = await import('./WrappedPage')

const mock = supabase as unknown as SupabaseMock

const AC_ME = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ac@l2hub.local',
  full_name: 'Mr. Jan',
  role: 'ac',
  created_at: '2026-01-01T00:00:00Z',
  permissions: [
    'events.view',
    'wrapped.view_published',
    'wrapped.present',
    'notifications.view_own',
  ],
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    name: 'Maze Day',
    slug: 'maze-day-2026',
    year: 2026,
    eventStatus: 'complete',
    summaryStatus: 'published',
    managingCommitteeId: null,
    wrappedPresentedAt: null,
    ...overrides,
  }
}

const RECAP = {
  event: event({ wrappedPresentedAt: '2026-08-07T18:00:00Z' }),
  presentedAt: '2026-08-07T18:00:00Z',
  hero: {
    title: 'Maze Day 2026',
    tagline: "Let's look back.",
    contributors: 48,
    submissionRate: 96,
  },
  overallRating: { score: 4.82, max: 5 },
  participation: {
    invited: 50,
    submitted: 48,
    absent: 2,
    completionPercent: 96,
  },
  committeeRankings: [{ name: 'Community', rating: 4.91 }],
  topStrengths: [
    {
      id: 'communication',
      label: 'Communication',
      mentions: 14,
      summary: 'Radios worked.',
    },
  ],
  topImprovements: [
    {
      id: 'earlier_setup',
      label: 'Earlier Setup',
      mentions: 31,
      summary: 'Setup ran late.',
    },
  ],
  materialRequests: [],
  summary: 'Maze Day ran at 96% completion.',
  recommendedActions: ['Lock a T-45 load-in checklist'],
}

function mockApi(handlers: Record<string, { status?: number; body: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const match = Object.entries(handlers)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => url.includes(path))
    if (!match) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: 'no mock' }),
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

describe('Event recap drop-down', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('hides the expander until the Wrapped has been reviewed with the class', async () => {
    mockApi({
      '/auth/me': { body: AC_ME },
      '/events': { body: { events: [event()] } },
    })

    renderWithProviders(<EventsPage />)

    expect(await screen.findByText('Maze Day 2026')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Maze Day 2026 recap/ }),
    ).not.toBeInTheDocument()
  })

  it('expands an event into its Wrapped recap once reviewed', async () => {
    const user = userEvent.setup()
    mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/recap': { body: RECAP },
      '/events': {
        body: {
          events: [event({ wrappedPresentedAt: '2026-08-07T18:00:00Z' })],
        },
      },
    })

    renderWithProviders(<EventsPage />)

    const toggle = await screen.findByRole('button', {
      name: 'Show Maze Day 2026 recap',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Wrapped recap')).not.toBeInTheDocument()

    await user.click(toggle)

    expect(await screen.findByText('Wrapped recap')).toBeInTheDocument()
    expect(screen.getByText('Maze Day ran at 96% completion.')).toBeInTheDocument()
    expect(screen.getByText('4.82 / 5')).toBeInTheDocument()
    expect(screen.getByText('Earlier Setup')).toBeInTheDocument()
    expect(screen.getByText('Lock a T-45 load-in checklist')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hide Maze Day 2026 recap' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapses the recap again', async () => {
    const user = userEvent.setup()
    mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/recap': { body: RECAP },
      '/events': {
        body: {
          events: [event({ wrappedPresentedAt: '2026-08-07T18:00:00Z' })],
        },
      },
    })

    renderWithProviders(<EventsPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Show Maze Day 2026 recap' }),
    )
    expect(await screen.findByText('Wrapped recap')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide Maze Day 2026 recap' }))
    await waitFor(() => {
      expect(screen.queryByText('Wrapped recap')).not.toBeInTheDocument()
    })
  })

  it('does not request a recap before the row is expanded', async () => {
    const fetchSpy = mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/recap': { body: RECAP },
      '/events': {
        body: {
          events: [event({ wrappedPresentedAt: '2026-08-07T18:00:00Z' })],
        },
      },
    })

    renderWithProviders(<EventsPage />)
    await screen.findByRole('button', { name: 'Show Maze Day 2026 recap' })

    expect(
      fetchSpy.mock.calls.filter(([input]) => String(input).includes('/recap')),
    ).toHaveLength(0)
  })

  it('surfaces a retry when the recap cannot load', async () => {
    const user = userEvent.setup()
    mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/recap': {
        status: 403,
        body: { detail: 'denied' },
      },
      '/events': {
        body: {
          events: [event({ wrappedPresentedAt: '2026-08-07T18:00:00Z' })],
        },
      },
    })

    renderWithProviders(<EventsPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Show Maze Day 2026 recap' }),
    )

    expect(await screen.findByText('Could not load recap')).toBeInTheDocument()
  })
})

const MEMBER_ME = {
  ...AC_ME,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'member',
  permissions: ['events.view', 'wrapped.view_published'],
}

function wrappedPayload(presentedAt: string | null = null) {
  return {
    event: event({
      summaryStatus: 'published',
      wrappedPresentedAt: presentedAt,
    }),
    status: 'published',
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
    graph: { nodes: [], edges: [], themes: [] },
    executiveSummary: {
      summary: 'Summary text',
      successes: [],
      recommendedActions: [],
    },
  }
}

function renderWrapped() {
  return renderWithProviders(
    <Routes>
      <Route path="/events/:eventId/wrapped" element={<WrappedPage />} />
    </Routes>,
    { route: '/events/maze-day-2026/wrapped' },
  )
}

/** Walk the deck the way a presenter does, to its final slide. */
async function clickThroughDeck(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 20; i += 1) {
    const next = screen.getByRole('button', { name: 'Next' })
    if ((next as HTMLButtonElement).disabled) return
    await user.click(next)
  }
}

function presentedCalls(spy: ReturnType<typeof mockApi>) {
  return spy.mock.calls.filter(([input]) =>
    String(input).includes('/wrapped/presented'),
  )
}

describe('Marking a Wrapped as reviewed with the class', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('unlocks the recap when the presenter reaches the last slide', async () => {
    const user = userEvent.setup()
    const fetchSpy = mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/wrapped/presented': {
        body: { status: 'published', presentedAt: '2026-08-07T18:00:00Z' },
      },
      '/events/maze-day-2026/wrapped': { body: wrappedPayload() },
    })

    renderWrapped()
    await screen.findByRole('heading', { name: 'Maze Day 2026' })
    expect(presentedCalls(fetchSpy)).toHaveLength(0)

    await clickThroughDeck(user)

    await waitFor(() => {
      expect(presentedCalls(fetchSpy)).toHaveLength(1)
    })
    expect(presentedCalls(fetchSpy)[0][1]).toMatchObject({ method: 'POST' })
    expect(await screen.findByText(/Reviewed with the class/)).toBeInTheDocument()
  })

  it('does not let a member mark the Wrapped as reviewed', async () => {
    const user = userEvent.setup()
    const fetchSpy = mockApi({
      '/auth/me': { body: MEMBER_ME },
      '/events/maze-day-2026/wrapped/presented': { body: {} },
      '/events/maze-day-2026/wrapped': { body: wrappedPayload() },
    })

    renderWrapped()
    await screen.findByRole('heading', { name: 'Maze Day 2026' })
    await clickThroughDeck(user)

    expect(presentedCalls(fetchSpy)).toHaveLength(0)
    expect(
      screen.queryByRole('button', { name: 'Mark reviewed with class' }),
    ).not.toBeInTheDocument()
  })

  it('does not re-mark an event the class already went through', async () => {
    const user = userEvent.setup()
    const fetchSpy = mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/wrapped/presented': { body: {} },
      '/events/maze-day-2026/wrapped': {
        body: wrappedPayload('2026-08-01T18:00:00Z'),
      },
    })

    renderWrapped()
    await screen.findByRole('heading', { name: 'Maze Day 2026' })
    await clickThroughDeck(user)

    expect(presentedCalls(fetchSpy)).toHaveLength(0)
  })

  it('gives list view a manual control for presenters', async () => {
    const user = userEvent.setup()
    const fetchSpy = mockApi({
      '/auth/me': { body: AC_ME },
      '/events/maze-day-2026/wrapped/presented': {
        body: { status: 'published', presentedAt: '2026-08-07T18:00:00Z' },
      },
      '/events/maze-day-2026/wrapped': { body: wrappedPayload() },
    })

    renderWrapped()
    await user.click(await screen.findByRole('button', { name: 'List view' }))
    await user.click(screen.getByRole('button', { name: 'Mark reviewed with class' }))

    await waitFor(() => {
      expect(presentedCalls(fetchSpy)).toHaveLength(1)
    })
    expect(await screen.findByRole('button', { name: 'Recap unlocked' })).toBeDisabled()
  })
})
