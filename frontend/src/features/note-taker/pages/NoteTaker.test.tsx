import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { NoteTakerLayout } from './NoteTakerLayout'
import { NoteTakerListPage } from './NoteTakerListPage'
import { NoteTakerSessionPage } from './NoteTakerSessionPage'

const authState = vi.hoisted(() => ({
  permissions: ['note_taker.view', 'note_taker.record'] as string[],
}))

const apiState = vi.hoisted(() => ({
  session: {
    id: 'sess-1',
    title: 'Maze planning',
    eventId: null as string | null,
    status: 'ready' as string,
    durationMs: 4200,
    audioContentType: 'audio/webm',
    audioSizeBytes: 1200,
    hasAudio: true,
    hasTranscript: true,
    hasNote: true,
    errorMessage: null as string | null,
    startedAt: '2026-08-08T12:00:00.000Z',
    endedAt: '2026-08-08T12:01:00.000Z',
    createdAt: '2026-08-08T12:00:00.000Z',
    createdBy: 'user-1',
    noteTitle: 'Maze planning',
  },
}))

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: async () => ({
    id: 'user-1',
    email: 'member@l2hub.local',
    full_name: 'Test Member',
    role: 'member',
    permissions: authState.permissions,
  }),
  hasPermission: (user: { permissions?: string[] }, key: string) =>
    Boolean(user.permissions?.includes(key)),
}))

vi.mock('../../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../event-summary/api', () => ({
  fetchEvents: async () => ({
    events: [
      {
        id: 'event-maze',
        name: 'Maze Day',
        slug: 'maze-day',
        year: 2026,
        eventStatus: 'scheduled',
        startsAt: null,
        endsAt: null,
        summaryStatus: 'not_requested',
        managingCommitteeId: null,
        wrappedPresentedAt: null,
      },
    ],
  }),
}))

vi.mock('../api/client', () => ({
  listMeetingSessions: async () => ({ sessions: [apiState.session] }),
  getMeetingSession: async () => apiState.session,
  getMeetingNote: async () => ({
    title: 'Maze planning',
    summary: 'Summary of the Maze planning call.',
    sections: [
      { title: 'Key points', bullets: ['Lock the theme'] },
      { title: 'Key decisions', bullets: ['We decided to lock the theme.'] },
      { title: 'Action items', bullets: ['Alex will update the flyer.'] },
      { title: 'Open questions', bullets: [] },
    ],
  }),
  getMeetingTranscript: async () => ({
    fullText: 'We decided to lock the theme. Alex will update the flyer.',
    segments: [
      { startMs: 0, endMs: 1500, text: 'We decided to lock the theme.' },
      { startMs: 1500, endMs: 3000, text: 'Alex will update the flyer.' },
    ],
    language: 'en',
    provider: 'chrome-web-speech',
  }),
  fetchMeetingAudioObjectUrl: async () => 'blob:mock-audio',
  createMeetingSession: vi.fn(),
  renameMeetingSession: vi.fn(),
  getSuggestedMeetingTitle: vi.fn(),
  uploadMeetingAudio: vi.fn(),
}))

function renderNoteTaker(route = '/note-taker') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/note-taker" element={<NoteTakerLayout />}>
            <Route index element={<NoteTakerListPage />} />
            <Route path=":sessionId" element={<NoteTakerSessionPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  authState.permissions = ['note_taker.view', 'note_taker.record']
  apiState.session = { ...apiState.session, status: 'ready', eventId: null }
})

describe('Note Taker gate', () => {
  it('blocks users without note_taker.view', async () => {
    authState.permissions = []
    renderNoteTaker()
    expect(await screen.findByText('Unauthorized')).toBeInTheDocument()
  })

  it('lists sessions for an authorized member', async () => {
    renderNoteTaker()
    expect(await screen.findByRole('heading', { name: 'Note Taker' })).toBeInTheDocument()
    expect((await screen.findAllByText('Maze planning')).length).toBeGreaterThanOrEqual(1)
    expect(await screen.findByText('Ready')).toBeInTheDocument()
  })
})

describe('Note Taker session tabs', () => {
  it('shows meeting note, raw transcript, and audio tabs', async () => {
    const user = userEvent.setup()
    renderNoteTaker('/note-taker/sess-1')

    expect(await screen.findByRole('heading', { name: 'Maze planning' })).toBeInTheDocument()
    expect(await screen.findByText('Summary of the Maze planning call.')).toBeInTheDocument()
    expect(screen.getByText('We decided to lock the theme.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Raw transcript' }))
    expect(await screen.findByRole('heading', { name: 'Raw transcript' })).toBeInTheDocument()
    expect(screen.getByText('Alex will update the flyer.')).toBeInTheDocument()
    expect(screen.getByText('0:00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Original audio' }))
    expect(await screen.findByRole('heading', { name: 'Original audio' })).toBeInTheDocument()
    await waitFor(() => {
      expect(document.querySelector('audio')).toBeTruthy()
    })
  })

  it('links a filed meeting back to its event timeline', async () => {
    apiState.session = { ...apiState.session, eventId: 'event-maze' }
    renderNoteTaker('/note-taker/sess-1')

    const link = await screen.findByRole('link', { name: 'Maze Day 2026' })
    expect(link).toHaveAttribute('href', '/event-planning?campfire=event-maze')
  })

  it('shows no event link for a general meeting', async () => {
    renderNoteTaker('/note-taker/sess-1')
    expect(await screen.findByRole('heading', { name: 'Maze planning' })).toBeInTheDocument()
    expect(screen.queryByText(/Filed under/)).toBeNull()
  })

  it('explains that the note is pending while processing', async () => {
    apiState.session = { ...apiState.session, status: 'processing' }
    renderNoteTaker('/note-taker/sess-1')
    expect(
      await screen.findByText(/Drafting the meeting note from the Chrome transcript/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/meeting note appears here when transcription finishes/),
    ).toBeInTheDocument()
  })
})
