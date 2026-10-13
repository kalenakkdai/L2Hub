import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CommitteeDetail, CommitteeDirectory } from './types'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>(
      '../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { CommitteesPage } = await import('./CommitteesPage')
const { CommitteeDetailPage } = await import('./CommitteeDetailPage')

const mock = supabase as unknown as SupabaseMock

const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.edu',
  full_name: 'Ada Lovelace',
  role: 'asbo',
  created_at: '2026-01-01T00:00:00Z',
  permissions: [],
}

const DIRECTORY: CommitteeDirectory = {
  camperTotal: 9,
  committees: [
    {
      id: 'activities',
      name: 'Activities',
      head: 'Hanna Rahmanian, Kaiwei Parks',
      email: 'msjateam@gmail.com',
      camperCount: 5,
      isMine: false,
    },
    {
      id: 'student_store',
      name: 'Student Store',
      head: 'Melody Gao',
      email: 'msjstudentstore@gmail.com',
      camperCount: 4,
      isMine: true,
    },
  ],
}

const ACTIVITIES: CommitteeDetail = {
  ...DIRECTORY.committees[0],
  remainingCount: 0,
  members: [
    { id: 'h1', name: 'Hanna Rahmanian', position: 'Head', isHead: true },
    { id: 'k1', name: 'Kaiwei Parks', position: 'Head', isHead: true },
    { id: 'a1', name: 'Aarit Patnaik', position: null, isHead: false },
  ],
  tasks: [
    {
      id: 't1',
      title: 'Confirm booth layout with facilities',
      meta: 'Due Aug 8 · assigned to Hanna Rahmanian',
      status: 'In progress',
    },
  ],
  events: [
    {
      id: 'e1',
      startsAt: '2026-10-20T15:00:00.000Z',
      title: 'Maze Day',
      detail: 'Quad',
    },
  ],
}

const TECH: CommitteeDetail = {
  id: 'tech',
  name: 'Tech',
  head: 'Samay Jain',
  email: 'msjhtechteam@gmail.com',
  camperCount: 1,
  isMine: false,
  remainingCount: 0,
  members: [{ id: 's1', name: 'Samay Jain', position: 'Head', isHead: true }],
  tasks: [],
  events: [],
}

const ELECTIONS: CommitteeDetail = {
  id: 'elections',
  name: 'Elections',
  head: null,
  email: null,
  camperCount: 0,
  isMine: false,
  remainingCount: 0,
  members: [],
  tasks: [],
  events: [],
}

function detailFor(url: string): { status: number; body: unknown } | null {
  if (url.endsWith('/committees/activities')) return { status: 200, body: ACTIVITIES }
  if (url.endsWith('/committees/tech')) return { status: 200, body: TECH }
  if (url.endsWith('/committees/elections')) return { status: 200, body: ELECTIONS }
  if (url.endsWith('/committees/not-a-committee')) {
    return { status: 404, body: { detail: 'Committee not found.' } }
  }
  if (url.endsWith('/committees')) return { status: 200, body: DIRECTORY }
  return null
}

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const hit = detailFor(url) ?? { status: 200, body: PROFILE }
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      json: async () => hit.body,
    } as Response
  })
}

describe('CommitteesPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    mockApi()
  })

  it('lists every committee with its head, roster size, and the campsite total', async () => {
    renderWithProviders(<CommitteesPage />)

    expect(await screen.findByRole('heading', { name: 'Committees' })).toBeInTheDocument()
    expect(screen.getByText('L2 Campsite · 9 campers')).toBeInTheDocument()

    const rows = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(rows).toHaveLength(DIRECTORY.committees.length)
    expect(screen.getByText('Activities')).toBeInTheDocument()
    expect(screen.getByText('Hanna Rahmanian, Kaiwei Parks')).toBeInTheDocument()
    expect(screen.getByText('5 campers')).toBeInTheDocument()
    expect(screen.getByText('4 campers')).toBeInTheDocument()
  })

  it('marks the committees the camper belongs to', async () => {
    renderWithProviders(<CommitteesPage />)
    await screen.findByRole('heading', { name: 'Committees' })

    expect(screen.getAllByText('You are in this committee')).toHaveLength(1)
  })

  it('links each row to its detail page', async () => {
    renderWithProviders(<CommitteesPage />)
    await screen.findByRole('heading', { name: 'Committees' })

    expect(screen.getByRole('link', { name: /Activities/ })).toHaveAttribute(
      'href',
      '/committees/activities',
    )
    expect(screen.getByRole('link', { name: /Student Store/ })).toHaveAttribute(
      'href',
      '/committees/student_store',
    )
  })
})

describe('CommitteeDetailPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    mockApi()
  })

  const renderDetail = (id: string) =>
    renderWithProviders(
      <Routes>
        <Route path="/committees/:committeeId" element={<CommitteeDetailPage />} />
      </Routes>,
      { route: `/committees/${id}` },
    )

  it('shows the roster, committee email, tasks, and events', async () => {
    renderDetail('activities')

    expect(
      await screen.findByRole('heading', { name: 'Activities', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/msjateam@gmail.com/)).toBeInTheDocument()

    const roster = screen.getByRole('region', { name: 'Campers' })
    expect(within(roster).getAllByRole('listitem')).toHaveLength(ACTIVITIES.members.length)
    expect(within(roster).getByText('Hanna Rahmanian')).toBeInTheDocument()
    expect(within(roster).getByText('Kaiwei Parks')).toBeInTheDocument()
    expect(within(roster).getByText('Aarit Patnaik')).toBeInTheDocument()

    expect(screen.getByText(ACTIVITIES.tasks[0].title)).toBeInTheDocument()
    expect(screen.getByText(ACTIVITIES.events[0].title)).toBeInTheDocument()
  })

  it('names the committee head in the roster', async () => {
    renderDetail('activities')
    await screen.findByRole('heading', { name: 'Activities', level: 1 })

    const roster = screen.getByRole('region', { name: 'Campers' })
    expect(within(roster).getAllByText(/Committee head/).length).toBeGreaterThanOrEqual(1)
  })

  it('says the roster is complete when every camper is listed', async () => {
    renderDetail('tech')
    await screen.findByRole('heading', { name: 'Tech', level: 1 })

    expect(screen.getByText('That is the whole committee.')).toBeInTheDocument()
    expect(screen.getByText(/msjhtechteam@gmail.com/)).toBeInTheDocument()
    expect(screen.getByText('Samay Jain')).toBeInTheDocument()
  })

  it('shows empty states for a committee with no tasks or events', async () => {
    renderDetail('elections')
    await screen.findByRole('heading', { name: 'Elections', level: 1 })

    expect(
      screen.getByText('Tasks assigned to this committee will land here.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This committee has no events on the calendar.'),
    ).toBeInTheDocument()
  })

  it('reports an unknown committee rather than rendering an empty page', async () => {
    renderDetail('not-a-committee')

    expect(await screen.findByRole('alert')).toHaveTextContent('No such committee')
  })
})
