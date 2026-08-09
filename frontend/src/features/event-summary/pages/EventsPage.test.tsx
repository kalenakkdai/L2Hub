import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const mock = supabase as unknown as SupabaseMock

const NOW = '2026-08-07T12:00:00Z'

const ME = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ac@l2hub.local',
  full_name: 'Mr. Jan',
  role: 'ac',
  created_at: '2026-01-01T00:00:00Z',
  permissions: ['events.view', 'wrapped.view_published', 'notifications.view_own'],
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: String(overrides.slug ?? 'id'),
    name: 'Event',
    slug: 'event',
    year: 2026,
    eventStatus: 'scheduled',
    startsAt: null,
    endsAt: null,
    summaryStatus: 'not_requested',
    managingCommitteeId: null,
    wrappedPresentedAt: null,
    ...overrides,
  }
}

function mockApi(events: unknown[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.includes('/auth/me')
      ? ME
      : url.includes('/events')
        ? { events }
        : { notifications: [] }
    return { ok: true, status: 200, json: async () => body } as Response
  })
}

function block(name: string) {
  return screen.getByRole('region', { name })
}

describe('Events page blocks', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the three blocks even when every one of them is empty', async () => {
    mockApi([])
    renderWithProviders(<EventsPage />)

    expect(await screen.findByRole('region', { name: 'Happening now' })).toBeInTheDocument()
    expect(block('Upcoming')).toBeInTheDocument()
    expect(block('Previous (2026)')).toBeInTheDocument()
  })

  it('files each event into the block that matches its schedule', async () => {
    mockApi([
      event({
        slug: 'running',
        name: 'Rally',
        startsAt: '2026-08-07T09:00:00Z',
        endsAt: '2026-08-07T18:00:00Z',
      }),
      event({ slug: 'later', name: 'Homecoming', startsAt: '2026-10-01T15:00:00Z' }),
      event({
        slug: 'done',
        name: 'Maze Day',
        eventStatus: 'complete',
        summaryStatus: 'published',
      }),
    ])
    renderWithProviders(<EventsPage />)

    expect(await screen.findByText('Rally 2026')).toBeInTheDocument()
    expect(within(block('Happening now')).getByText('Rally 2026')).toBeInTheDocument()
    expect(within(block('Upcoming')).getByText('Homecoming 2026')).toBeInTheDocument()
    expect(within(block('Previous (2026)')).getByText('Maze Day 2026')).toBeInTheDocument()
  })

  it('explains an empty block instead of leaving a blank card', async () => {
    mockApi([
      event({
        slug: 'done',
        name: 'Maze Day',
        eventStatus: 'complete',
        summaryStatus: 'published',
      }),
    ])
    renderWithProviders(<EventsPage />)

    await screen.findByText('Maze Day 2026')
    expect(
      within(block('Happening now')).getByText(
        'No approved events are active right now.',
      ),
    ).toBeInTheDocument()
    expect(within(block('Upcoming')).getByText('No upcoming events scheduled.')).toBeInTheDocument()
  })

  it('keeps prior-year events reachable behind an Earlier years toggle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApi([
      event({
        slug: 'old',
        name: 'Maze Day',
        year: 2025,
        eventStatus: 'complete',
        summaryStatus: 'published',
      }),
      event({
        slug: 'new',
        name: 'Rally',
        year: 2026,
        eventStatus: 'complete',
        summaryStatus: 'published',
      }),    ])
    renderWithProviders(<EventsPage />)

    await screen.findByText('Rally 2026')
    const previous = within(block('Previous (2026)'))
    expect(previous.getByText('Rally 2026')).toBeInTheDocument()
    expect(previous.queryByText('Maze Day 2025')).not.toBeInTheDocument()

    await user.click(previous.getByRole('button', { name: /Earlier years \(1\)/ }))
    expect(previous.getByText('Maze Day 2025')).toBeInTheDocument()
  })

  it('shows the scheduled date alongside the event status', async () => {
    mockApi([event({ slug: 'later', name: 'Homecoming', startsAt: '2026-10-01T15:00:00Z' })])
    renderWithProviders(<EventsPage />)

    await screen.findByText('Homecoming 2026')
    expect(within(block('Upcoming')).getByText(/Oct 1, 2026 · scheduled/)).toBeInTheDocument()
  })
})
