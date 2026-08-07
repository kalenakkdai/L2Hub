import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
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
const { DebriefsPage } = await import('./DebriefsPage')

const mock = supabase as unknown as SupabaseMock

const ME = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ac@l2hub.local',
  full_name: 'Mr. Jan',
  role: 'ac',
  created_at: '2026-01-01T00:00:00Z',
  permissions: ['events.view', 'debrief.view_all', 'notifications.view_own'],
}

const EVENT = {
  id: '1',
  name: 'Maze Day',
  slug: 'maze-day-2026',
  year: 2026,
  eventStatus: 'complete',
  summaryStatus: 'published',
  managingCommitteeId: null,
}

function participant(id: string, status: string) {
  return { id, displayName: `Leader ${id}`, status, submittedAt: null }
}

function mockApi(live: { status?: number; body: unknown }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const reply = (status: number, body: unknown) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }) as Response

    if (url.includes('/live')) return reply(live.status ?? 200, live.body)
    if (url.includes('/auth/me')) return reply(200, ME)
    if (url.includes('/events')) return reply(200, { events: [EVENT] })
    return reply(404, { detail: `No mock for ${url}` })
  })
}

describe('DebriefsPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('counts a debrief as open while people are writing or have not started', async () => {
    mockApi({
      body: {
        eventId: '1',
        participants: [
          participant('a', 'submitted'),
          participant('b', 'writing'),
          participant('c', 'not_started'),
          participant('d', 'absent'),
        ],
      },
    })

    renderWithProviders(<DebriefsPage />)

    expect(await screen.findByText('Open · 2 outstanding')).toBeInTheDocument()
    expect(screen.getByText(/1 submitted/)).toBeInTheDocument()
  })

  it('reports all submitted once nobody is outstanding', async () => {
    mockApi({
      body: {
        eventId: '1',
        participants: [participant('a', 'submitted'), participant('b', 'absent')],
      },
    })

    renderWithProviders(<DebriefsPage />)

    expect(await screen.findByText('All submitted')).toBeInTheDocument()
    expect(screen.queryByText(/outstanding/)).not.toBeInTheDocument()
  })

  it('explains a forbidden monitor instead of showing an empty debrief', async () => {
    mockApi({ status: 403, body: { detail: 'denied' } })

    renderWithProviders(<DebriefsPage />)

    expect(
      await screen.findByText('You do not have access to this debrief monitor.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Live monitor' })).not.toBeInTheDocument()
  })

  it('links to the live monitor for an accessible debrief', async () => {
    mockApi({
      body: { eventId: '1', participants: [participant('a', 'writing')] },
    })

    renderWithProviders(<DebriefsPage />)

    expect(await screen.findByRole('link', { name: 'Live monitor' })).toHaveAttribute(
      'href',
      '/events/maze-day-2026/live',
    )
  })
})
