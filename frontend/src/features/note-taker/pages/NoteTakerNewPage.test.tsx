import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { NoteTakerNewPage } from './NoteTakerNewPage'

const state = vi.hoisted(() => ({
  suggestedFor: [] as (string | null)[],
}))

vi.mock('../../event-summary/api', () => ({
  fetchEvents: async () => ({
    events: [
      {
        id: 'live-1',
        name: 'Maze Day',
        slug: 'maze-day',
        year: 2026,
        eventStatus: 'scheduled',
        startsAt: '2026-08-07T00:00:00Z',
        endsAt: '2026-08-09T00:00:00Z',
        summaryStatus: 'not_requested',
        managingCommitteeId: null,
        wrappedPresentedAt: null,
      },
      {
        id: 'soon-1',
        name: 'Fall Rally',
        slug: 'fall-rally',
        year: 2026,
        eventStatus: 'scheduled',
        startsAt: '2026-09-20T00:00:00Z',
        endsAt: null,
        summaryStatus: 'not_requested',
        managingCommitteeId: null,
        wrappedPresentedAt: null,
      },
    ],
  }),
}))

vi.mock('../api/client', () => ({
  getSuggestedMeetingTitle: async (eventId: string | null) => {
    state.suggestedFor.push(eventId)
    return { title: eventId ? `${eventId} · Meeting 1` : 'Leadership meeting 1' }
  },
  createMeetingSession: vi.fn(),
  uploadMeetingAudio: vi.fn(),
  renameMeetingSession: vi.fn(),
  listMeetingSessions: async () => ({ sessions: [] }),
  getMeetingSession: vi.fn(),
}))

function renderNewPage(route = '/note-taker/new') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/note-taker"
            element={<Outlet context={{ canRecord: true }} />}
          >
            <Route path="new" element={<NoteTakerNewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  state.suggestedFor = []
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: class {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 1
      onresult = null
      onerror = null
      onend = null
      start() {}
      stop() {}
      abort() {}
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'SpeechRecognition')
})

describe('NoteTakerNewPage event picker', () => {
  it('offers events grouped by phase, defaulting to no event', async () => {
    renderNewPage()

    const select = (await screen.findByLabelText('Event')) as HTMLSelectElement
    expect(select.value).toBe('')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Maze Day 2026' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Fall Rally 2026' })).toBeInTheDocument()

    const groups = Array.from(select.querySelectorAll('optgroup')).map(
      (group) => group.label,
    )
    expect(groups).toEqual(['Happening now', 'Upcoming'])
  })

  it('files under the event chosen from the dropdown', async () => {
    const user = userEvent.setup()
    renderNewPage()

    const select = (await screen.findByLabelText('Event')) as HTMLSelectElement
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Maze Day 2026' })).toBeInTheDocument()
    })

    await user.selectOptions(select, 'live-1')

    expect(select.value).toBe('live-1')
    expect(await screen.findByText('Filing under Maze Day 2026')).toBeInTheDocument()
    // The auto-name comes from the server for the newly chosen event.
    await waitFor(() => {
      expect(state.suggestedFor).toContain('live-1')
    })
  })

  it('links the chosen event to its campfire timeline', async () => {
    const user = userEvent.setup()
    renderNewPage()

    const select = (await screen.findByLabelText('Event')) as HTMLSelectElement
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Maze Day 2026' })).toBeInTheDocument()
    })
    // No event chosen yet, so there is no timeline to open.
    expect(screen.queryByRole('link', { name: 'Open timeline' })).toBeNull()

    await user.selectOptions(select, 'live-1')

    const link = await screen.findByRole('link', { name: 'Open timeline' })
    expect(link).toHaveAttribute('href', '/event-planning?campfire=live-1')
  })

  it('preselects the event a campfire link points at', async () => {
    renderNewPage('/note-taker/new?eventId=soon-1&eventName=Fall%20Rally%202026')

    const select = (await screen.findByLabelText('Event')) as HTMLSelectElement
    expect(select.value).toBe('soon-1')
    expect(
      await screen.findByText('Filing under Fall Rally 2026'),
    ).toBeInTheDocument()
  })
})
