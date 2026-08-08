import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import { renderWithProviders } from '../../test/renderWithProviders'
import { SAMPLE_COMMITTEES, sampleCommitteeDetail } from './fixtures/sampleCommittees'

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

function mockProfile() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ada@example.edu',
      full_name: 'Ada Lovelace',
      role: 'asbo',
      created_at: '2026-01-01T00:00:00Z',
      permissions: [],
    }),
  } as Response)
}

describe('CommitteesPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    mockProfile()
  })

  it('lists every crew with its head and camper count', async () => {
    renderWithProviders(<CommitteesPage />)

    expect(await screen.findByRole('heading', { name: 'Crews' })).toBeInTheDocument()

    // Scope to <main>: the sidebar's nav entries are list items too.
    const rows = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(rows).toHaveLength(SAMPLE_COMMITTEES.length)
    expect(screen.getByText('Activities')).toBeInTheDocument()
    expect(screen.getByText('14 campers')).toBeInTheDocument()
  })

  it('says so when a crew has no head yet', async () => {
    renderWithProviders(<CommitteesPage />)
    await screen.findByRole('heading', { name: 'Crews' })

    expect(screen.getByText('No crew head yet')).toBeInTheDocument()
  })

  it('marks the crews the camper belongs to', async () => {
    renderWithProviders(<CommitteesPage />)
    await screen.findByRole('heading', { name: 'Crews' })

    const mine = SAMPLE_COMMITTEES.filter((committee) => committee.isMine)
    expect(screen.getAllByText('You are in this crew')).toHaveLength(mine.length)
  })

  it('links each row to its detail page', async () => {
    renderWithProviders(<CommitteesPage />)
    await screen.findByRole('heading', { name: 'Crews' })

    expect(screen.getByRole('link', { name: /Activities/ })).toHaveAttribute(
      'href',
      '/committees/activities',
    )
  })
})

describe('CommitteeDetailPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    mockProfile()
  })

  const renderDetail = (id: string) =>
    renderWithProviders(
      <Routes>
        <Route path="/committees/:committeeId" element={<CommitteeDetailPage />} />
      </Routes>,
      { route: `/committees/${id}` },
    )

  it('shows the roster, tasks, and events', async () => {
    renderDetail('activities')

    expect(
      await screen.findByRole('heading', { name: 'Activities', level: 1 }),
    ).toBeInTheDocument()

    const detail = sampleCommitteeDetail('activities')!
    const roster = screen.getByRole('region', { name: 'Campers' })
    expect(within(roster).getAllByRole('listitem')).toHaveLength(detail.members.length)

    expect(screen.getByText(detail.tasks[0].title)).toBeInTheDocument()
    expect(screen.getByText(detail.events[0].title)).toBeInTheDocument()
  })

  it('names the crew head in the roster', async () => {
    renderDetail('activities')
    await screen.findByRole('heading', { name: 'Activities', level: 1 })

    // The header subline also says "Crew head <name>", so scope to the roster.
    const roster = screen.getByRole('region', { name: 'Campers' })
    expect(within(roster).getByText(/Crew head/)).toBeInTheDocument()
  })

  it('reports how many campers are not listed', async () => {
    renderDetail('activities')
    await screen.findByRole('heading', { name: 'Activities', level: 1 })

    // 14 campers, 6 shown.
    expect(screen.getByText('and 8 more campers')).toBeInTheDocument()
  })

  it('says the roster is complete when it is', async () => {
    renderDetail('tech')
    await screen.findByRole('heading', { name: 'Tech', level: 1 })

    expect(screen.getByText('That is the whole crew.')).toBeInTheDocument()
  })

  it('shows empty states for a crew with no tasks or events', async () => {
    renderDetail('elections')
    await screen.findByRole('heading', { name: 'Elections', level: 1 })

    expect(
      screen.getByText('Tasks assigned to this crew will land here.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This crew has no events on the calendar.'),
    ).toBeInTheDocument()
  })

  it('reports an unknown crew rather than rendering an empty page', async () => {
    renderDetail('not-a-committee')

    expect(await screen.findByRole('alert')).toHaveTextContent('No such crew')
  })
})

describe('crew fixture', () => {
  it('puts the head first and never duplicates a camper', () => {
    for (const committee of SAMPLE_COMMITTEES) {
      const detail = sampleCommitteeDetail(committee.id)!
      const names = detail.members.map((member) => member.name)

      expect(new Set(names).size).toBe(names.length)
      if (committee.head) expect(detail.members[0].name).toBe(committee.head)
    }
  })

  it('returns null for an id that does not exist', () => {
    expect(sampleCommitteeDetail('nope')).toBeNull()
  })
})
