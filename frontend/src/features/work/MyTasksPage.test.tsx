import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeQueryClient } from '../../test/renderWithProviders'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>(
      '../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { AuthProvider } = await import('../../auth/AuthProvider')
const { MyTasksPage } = await import('./MyTasksPage')

const mock = supabase as unknown as SupabaseMock

const CAMPFIRE = {
  event: {
    id: 'evt-1',
    name: 'Fall Rally',
    slug: 'fall-rally',
    year: 2026,
    status: 'active',
    startsAt: '2026-10-09T00:00:00Z',
    endsAt: null,
  },
  tone: 'now' as const,
  progress: { total: 4, done: 1, percentComplete: 25 },
  myTasks: [
    {
      id: 't1',
      committeeId: 'c1',
      title: 'Hang banners',
      details: 'Gym doors',
      status: 'todo' as const,
      assignee: { id: 'me', name: 'Ada' },
      dueOn: null,
      createdAt: '2026-08-01T00:00:00Z',
      event: null,
      originTaskId: null,
      fromCommittee: null,
    },
  ],
  assignees: [
    {
      id: 'me',
      name: 'Ada',
      isMe: true,
      total: 1,
      done: 0,
      percentComplete: 0,
    },
    {
      id: 'other',
      name: 'Jan',
      isMe: false,
      total: 3,
      done: 1,
      percentComplete: 33,
    },
  ],
}

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/tasks']}>
        <AuthProvider>
          <MyTasksPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MyTasksPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo) => {
        const url = String(input)
        if (url.includes('/auth/me') || url.endsWith('/me')) {
          return reply(200, {
            id: 'me',
            email: 'ada@msjhs.org',
            full_name: 'Ada Lovelace',
            role: 'member',
            created_at: '2026-01-01T00:00:00Z',
            permissions: ['tasks.view_own'],
            roles: [],
          })
        }
        if (url.includes('/tasks/mine')) {
          return reply(200, {
            openTaskCount: 1,
            campfires: [CAMPFIRE],
            unlinkedTasks: [],
          })
        }
        return reply(404, { detail: 'missing' })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the rotating campfire ring for happening events', async () => {
    renderPage()
    expect(
      await screen.findByRole('list', { name: 'Event campfires' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Fall Rally 2026, 25% complete/,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 open')).toBeInTheDocument()
  })

  it('opens tasks and progress after the owl flies to a fire', async () => {
    const user = userEvent.setup()
    renderPage()
    const fire = await screen.findByRole('button', {
      name: /Fall Rally 2026, 25% complete/,
    })
    await user.click(fire)

    expect(
      await screen.findByRole('heading', { name: /Fall Rally/ }, { timeout: 2000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Hang banners')).toBeInTheDocument()
    expect(screen.getByText('Ada (you)')).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByLabelText(/Event progress: 25% complete/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jan: 33% complete/)).toBeInTheDocument()
  })
})
