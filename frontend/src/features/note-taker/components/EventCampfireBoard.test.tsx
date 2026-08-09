import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EventCampfireBoard } from './EventCampfireBoard'
import type { MeetingSessionSummary } from '../types'

const eventsState = vi.hoisted(() => {
  const HOUR = 60 * 60 * 1000
  return {
    events: [
      {
        id: 'event-maze',
        name: 'Maze Day',
        slug: 'maze-day',
        year: 2026,
        eventStatus: 'active',
        // Started an hour ago and still running, so it groups as current.
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + HOUR).toISOString(),
        summaryStatus: 'not_requested',
        managingCommitteeId: null,
        wrappedPresentedAt: null,
      },
      {
        id: 'event-rally',
        name: 'Winter Rally',
        slug: 'winter-rally',
        year: 2026,
        eventStatus: 'active',
        startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
        endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
        summaryStatus: 'not_requested',
        managingCommitteeId: null,
        wrappedPresentedAt: null,
      },
    ],
  }
})

function session(
  id: string,
  title: string,
  createdAt: string,
): MeetingSessionSummary {
  return {
    id,
    title,
    eventId: 'event-maze',
    status: 'ready',
    durationMs: 1000,
    audioContentType: 'audio/webm',
    audioSizeBytes: 10,
    hasAudio: true,
    hasTranscript: true,
    hasNote: true,
    errorMessage: null,
    startedAt: createdAt,
    endedAt: createdAt,
    createdAt,
    createdBy: 'user-1',
    noteTitle: title,
  }
}

const mazeSessions = [
  session('sess-2', 'Maze Day 2026 · Meeting 2 · 8.8.2026', '2026-08-08T18:00:00.000Z'),
  session('sess-1', 'Maze Day 2026 · Meeting 1 · 8.1.2026', '2026-08-01T18:00:00.000Z'),
]

const renameMeetingSession = vi.hoisted(() => vi.fn())
const linkMeetingToEvent = vi.hoisted(() =>
  vi.fn(async (sessionId: string, eventId: string) => ({
    ...mazeSessions.find((item) => item.id === sessionId)!,
    eventIds: [eventId],
  })),
)

vi.mock('../../event-summary/api', () => ({
  fetchEvents: async () => ({ events: eventsState.events }),
}))

vi.mock('../api/client', () => ({
  listMeetingSessions: async (eventId?: string) => {
    if (!eventId) {
      return { sessions: mazeSessions }
    }
    return {
      sessions: eventId === 'event-maze' ? mazeSessions : [],
    }
  },
  createMeetingSession: vi.fn(),
  renameMeetingSession,
  linkMeetingToEvent,
  unlinkMeetingFromEvent: vi.fn(),
  getSuggestedMeetingTitle: vi.fn(),
  getMeetingSession: vi.fn(),
  getMeetingNote: vi.fn(),
  getMeetingTranscript: vi.fn(),
  uploadMeetingAudio: vi.fn(),
  fetchMeetingAudioObjectUrl: vi.fn(),
}))

function renderBoard(permissions: string[] | undefined, route = '/event-planning') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <EventCampfireBoard permissions={permissions} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EventCampfireBoard', () => {
  it('renders a campfire per running event with its log count', async () => {
    renderBoard(['note_taker.view', 'note_taker.record'])

    expect(await screen.findByText('Maze Day 2026')).toBeInTheDocument()
    expect(await screen.findByText(/2 logs on this fire/)).toBeInTheDocument()
    expect(await screen.findByText('Winter Rally 2026')).toBeInTheDocument()
    expect(
      await screen.findByText(/Drop logs here — fire grows with each one/),
    ).toBeInTheDocument()
  })

  it('shows a log yard and named logs under fires that already have them', async () => {
    renderBoard(['note_taker.view', 'note_taker.record'])

    expect(await screen.findByText('Log yard')).toBeInTheDocument()
    // Titles appear both in the yard and under the Maze Day fire.
    expect(
      screen.getAllByText('Maze Day 2026 · Meeting 1 · 8.1.2026').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('adds a selected log to a fire without drag', async () => {
    const user = userEvent.setup()
    renderBoard(['note_taker.view', 'note_taker.record'])

    // Events sort soonest-started first among running ones → Winter Rally, then Maze Day.
    const selects = await screen.findAllByLabelText('Or choose a log')
    await user.selectOptions(selects[0], 'sess-1')

    expect(linkMeetingToEvent).toHaveBeenCalledWith('sess-1', 'event-rally')
  })

  it('links the record button to a recording pre-filed under the event', async () => {
    renderBoard(['note_taker.view', 'note_taker.record'])

    const links = await screen.findAllByRole('link', { name: /Record meeting/ })
    expect(links.map((link) => link.getAttribute('href'))).toContain(
      '/note-taker/new?eventId=event-maze&eventName=Maze%20Day%202026',
    )
  })

  it('shows meeting docs oldest-first as a constellation once expanded', async () => {
    const user = userEvent.setup()
    renderBoard(['note_taker.view', 'note_taker.record'])

    await user.click(
      await screen.findByRole('button', { name: 'Expand Maze Day 2026 timeline' }),
    )

    const stars = await screen.findAllByRole('button', { name: /^Meeting \d/ })
    expect(stars.map((star) => star.getAttribute('aria-label'))).toEqual([
      'Meeting 1: Maze Day 2026 · Meeting 1 · 8.1.2026',
      'Meeting 2: Maze Day 2026 · Meeting 2 · 8.8.2026',
    ])
  })

  it('opens the timeline a ?campfire= deep link points at', async () => {
    renderBoard(
      ['note_taker.view', 'note_taker.record'],
      '/event-planning?campfire=event-maze',
    )

    const stars = await screen.findAllByRole('button', { name: /^Meeting \d/ })
    expect(stars).toHaveLength(2)

    expect(
      screen.getByRole('button', { name: 'Collapse Maze Day 2026 timeline' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('renames the auto-generated doc name', async () => {
    const user = userEvent.setup()
    renderBoard(['note_taker.view', 'note_taker.record'])

    await user.click(
      await screen.findByRole('button', { name: 'Expand Maze Day 2026 timeline' }),
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Meeting 1: Maze Day 2026 · Meeting 1 · 8.1.2026',
      }),
    )

    const input = screen.getByRole('textbox', { name: 'Rename meeting doc' })
    await user.clear(input)
    await user.type(input, '  Maze kickoff  ')
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    expect(renameMeetingSession).toHaveBeenCalledWith('sess-1', 'Maze kickoff')
  })

  it('renders nothing for a camper without note_taker.view', () => {
    const { container } = renderBoard([])
    expect(container).toBeEmptyDOMElement()
  })
})
