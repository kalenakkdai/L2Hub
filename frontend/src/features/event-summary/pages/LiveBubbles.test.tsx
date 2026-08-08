import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
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
const { LiveBubblesPage } = await import('./LiveBubblesPage')

const mock = supabase as unknown as SupabaseMock

const ME = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ac@l2hub.local',
  full_name: 'Mr. Jan',
  role: 'ac',
  created_at: '2026-01-01T00:00:00Z',
  permissions: ['events.view', 'debrief.monitor', 'notifications.view_own'],
}

const ROSTER = [
  { id: 'p1', displayName: 'Avery Chen', status: 'submitted', submittedAt: null },
  { id: 'p2', displayName: 'Jordan Lee', status: 'writing', submittedAt: null },
  { id: 'p3', displayName: 'Taylor Kim', status: 'not_started', submittedAt: null },
  { id: 'p4', displayName: 'Morgan Liu', status: 'absent', submittedAt: null },
]

function mockApi(participants: unknown[] = ROSTER) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.includes('/auth/me')
      ? ME
      : url.includes('/live')
        ? { eventId: 'maze-day-2026', participants }
        : { notifications: [] }
    return { ok: true, status: 200, json: async () => body } as Response
  })
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/events/:eventId/live" element={<LiveBubblesPage />} />
    </Routes>,
    { route: '/events/maze-day-2026/live' },
  )
}

describe('Live debrief bubbles', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('splits the screen into a roster side and a floating side', async () => {
    mockApi()
    renderPage()

    expect(
      await screen.findByRole('region', { name: 'Live debrief' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Bubble tank' })).toBeInTheDocument()
  })

  it('lists every participant with their status on the roster side', async () => {
    mockApi()
    renderPage()

    await screen.findByRole('region', { name: 'Live debrief' })
    const list = within(screen.getByRole('list', { name: 'Participants' }))
    expect(list.getByText('Avery Chen')).toBeInTheDocument()
    expect(list.getByText('Submitted')).toBeInTheDocument()
    expect(list.getByText('Writing')).toBeInTheDocument()
    expect(list.getByText('Not started')).toBeInTheDocument()
    expect(list.getByText('Absent')).toBeInTheDocument()
  })

  it('reports how much of the room has submitted', async () => {
    mockApi()
    renderPage()

    const roster = within(await screen.findByRole('region', { name: 'Live debrief' }))
    expect(roster.getByText('1 of 4 submitted · 25%')).toBeInTheDocument()
  })

  it('floats one bubble per participant on the other side', async () => {
    mockApi()
    renderPage()

    const tank = await screen.findByRole('region', { name: 'Bubble tank' })
    expect(tank.querySelectorAll('.bubble')).toHaveLength(ROSTER.length)
    expect(within(tank).getByText('Avery Chen')).toBeInTheDocument()
  })

  it('positions each bubble somewhere inside the tank', async () => {
    mockApi()
    renderPage()

    const tank = await screen.findByRole('region', { name: 'Bubble tank' })
    for (const slot of tank.querySelectorAll<HTMLElement>('.bubble-slot')) {
      const left = Number.parseFloat(slot.style.left)
      const top = Number.parseFloat(slot.style.top)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left).toBeLessThanOrEqual(100)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top).toBeLessThanOrEqual(100)
    }
  })

  it('gives each bubble the liquid film and lighting layers', async () => {
    mockApi()
    renderPage()

    const tank = await screen.findByRole('region', { name: 'Bubble tank' })
    const bubble = tank.querySelector('.bubble')

    expect(bubble?.querySelector('.bubble-film')).not.toBeNull()
    expect(bubble?.querySelector('.bubble-fresnel')).not.toBeNull()
    expect(bubble?.querySelector('.bubble-gloss')).not.toBeNull()
    expect(bubble?.querySelector('.bubble-spark')).not.toBeNull()
  })

  it('defines the turbulence filters the film refers to', async () => {
    mockApi()
    const { container } = renderPage()
    await screen.findByRole('region', { name: 'Bubble tank' })

    expect(container.querySelector('#bubble-liquid feDisplacementMap')).not.toBeNull()
    expect(container.querySelector('#bubble-sheen feDisplacementMap')).not.toBeNull()
  })

  it('handles an empty roster without breaking either side', async () => {
    mockApi([])
    renderPage()

    const roster = within(await screen.findByRole('region', { name: 'Live debrief' }))
    expect(roster.getByText('No participants yet.')).toBeInTheDocument()
    expect(roster.getByText('0 of 0 submitted · 0%')).toBeInTheDocument()

    const tank = screen.getByRole('region', { name: 'Bubble tank' })
    expect(tank.querySelectorAll('.bubble')).toHaveLength(0)
  })
})
