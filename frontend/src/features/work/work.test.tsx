import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>(
      '../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { L2BoardPage } = await import('./L2BoardPage')
const { RequestsPage } = await import('./RequestsPage')
const { Sidebar } = await import('../../components/layout/Sidebar')

const mock = supabase as unknown as SupabaseMock

const FUNDRAISING = 'f1111111-1111-4111-8111-111111111111'
const PUBLICITY = 'f2222222-2222-4222-8222-222222222222'

function profile(permissions: string[]) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.edu',
    full_name: 'Ada Lovelace',
    role: 'asbo',
    created_at: '2026-01-01T00:00:00Z',
    permissions,
  }
}

const BOARD = {
  committees: [
    {
      id: FUNDRAISING,
      name: 'Fundraising',
      slug: 'fundraising',
      isMine: true,
      canAddTask: true,
      openRequestCount: 0,
      tasks: [
        {
          id: 't1',
          committeeId: FUNDRAISING,
          title: 'Winter fundraiser',
          details: '',
          status: 'todo',
          assignee: { id: 'u1', name: 'Avery Chen' },
          dueOn: '2026-09-01',
          createdAt: '2026-08-01T00:00:00Z',
        },
      ],
    },
    {
      id: PUBLICITY,
      name: 'Publicity',
      slug: 'publicity',
      isMine: false,
      canAddTask: false,
      openRequestCount: 2,
      tasks: [],
    },
  ],
}

const PICKER = {
  committees: [
    { id: FUNDRAISING, name: 'Fundraising', slug: 'fundraising', canRequestFor: true },
    { id: PUBLICITY, name: 'Publicity', slug: 'publicity', canRequestFor: false },
  ],
}

/** Answers each endpoint by URL, and records what was posted. */
function mockApi(
  routes: Record<string, unknown>,
  permissions = ['tasks.view_all', 'requests.view_all'],
) {
  const posted: { url: string; body: unknown }[] = []

  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = String(input)
      if (init?.method && init.method !== 'GET') {
        posted.push({
          url,
          body: init.body ? JSON.parse(String(init.body)) : null,
        })
      }

      const match = Object.keys(routes).find((path) => url.endsWith(path))
      const body = url.includes('/auth/me')
        ? profile(permissions)
        : match
          ? routes[match]
          : {}

      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as Response
    })

  return { spy, posted }
}

describe('L2 Board', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('shows a column per committee with its tasks', async () => {
    mockApi({ '/board': BOARD, '/board/committees': PICKER })

    renderWithProviders(<L2BoardPage />)

    expect(await screen.findByRole('heading', { name: 'L2 Board' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fundraising' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Publicity' })).toBeInTheDocument()
    expect(screen.getByText('Winter fundraiser')).toBeInTheDocument()
    expect(screen.getByText('Avery Chen')).toBeInTheDocument()
  })

  it('says an empty column is empty rather than leaving it blank', async () => {
    mockApi({ '/board': BOARD, '/board/committees': PICKER })

    renderWithProviders(<L2BoardPage />)
    await screen.findByRole('heading', { name: 'Publicity' })

    expect(screen.getByText('Nothing on the board.')).toBeInTheDocument()
  })

  it('surfaces how many requests a committee has waiting on it', async () => {
    mockApi({ '/board': BOARD, '/board/committees': PICKER })

    renderWithProviders(<L2BoardPage />)
    await screen.findByRole('heading', { name: 'Publicity' })

    expect(screen.getByText('2 asked of them')).toBeInTheDocument()
  })

  it('offers Add task only on the committees the caller may write to', async () => {
    mockApi({ '/board': BOARD, '/board/committees': PICKER })

    renderWithProviders(<L2BoardPage />)
    await screen.findByRole('heading', { name: 'Fundraising' })

    // One button, on Fundraising — not on Publicity.
    const addButtons = screen.getAllByRole('button', { name: 'Add task' })
    expect(addButtons).toHaveLength(1)
  })
})

describe('listing a task that needs another committee', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  async function openDialog() {
    const api = mockApi({ '/board': BOARD, '/board/committees': PICKER })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />)
    await screen.findByRole('heading', { name: 'Fundraising' })
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    return { user, api, dialog: await screen.findByRole('dialog') }
  }

  it('sends a request to each committee ticked', async () => {
    const { user, api, dialog } = await openDialog()

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Task' }),
      'Winter fundraiser',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Publicity' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }))

    await waitFor(() => {
      const post = api.posted.find((p) => p.url.endsWith('/board/tasks'))
      expect(post?.body).toMatchObject({
        committeeId: FUNDRAISING,
        title: 'Winter fundraiser',
        collaboratorCommitteeIds: [PUBLICITY],
      })
    })
  })

  it('asks once before saving a task that needs nobody', async () => {
    const { user, api, dialog } = await openDialog()

    await user.type(within(dialog).getByRole('textbox', { name: 'Task' }), 'Solo job')
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }))

    // First press warns instead of saving.
    expect(await screen.findByRole('status')).toHaveTextContent(
      /No other committees selected/,
    )
    expect(api.posted.some((p) => p.url.endsWith('/board/tasks'))).toBe(false)

    // Second press goes through.
    await user.click(within(dialog).getByRole('button', { name: 'Save without help' }))
    await waitFor(() => {
      expect(api.posted.some((p) => p.url.endsWith('/board/tasks'))).toBe(true)
    })
  })
})

const REQUESTS = {
  requests: [
    {
      id: 'r1',
      requestingCommittee: { id: FUNDRAISING, name: 'Fundraising' },
      targetCommittee: { id: PUBLICITY, name: 'Publicity' },
      title: 'Instagram post for the winter fundraiser',
      details: '',
      status: 'open',
      dueOn: null,
      sourceTaskId: 't1',
      createdBy: { id: 'u1', name: 'Avery Chen' },
      respondedBy: null,
      respondedAt: null,
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'r2',
      requestingCommittee: { id: PUBLICITY, name: 'Publicity' },
      targetCommittee: { id: FUNDRAISING, name: 'Fundraising' },
      title: 'Send us the poster copy',
      details: '',
      status: 'done',
      dueOn: null,
      sourceTaskId: null,
      createdBy: { id: 'u2', name: 'Sam Ortiz' },
      respondedBy: { id: 'u1', name: 'Avery Chen' },
      respondedAt: '2026-08-02T00:00:00Z',
      createdAt: '2026-08-01T00:00:00Z',
    },
  ],
}

describe('Requests log', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('lists every ask with who asked whom', async () => {
    mockApi({ '/requests': REQUESTS })

    renderWithProviders(<RequestsPage />)

    expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument()
    expect(
      screen.getByText('Instagram post for the winter fundraiser'),
    ).toBeInTheDocument()
    expect(screen.getByText('Send us the poster copy')).toBeInTheDocument()
    // Both directions of the same pair are shown.
    expect(screen.getAllByText('Fundraising')).not.toHaveLength(0)
  })

  it('counts what is still open in the header', async () => {
    mockApi({ '/requests': REQUESTS })

    renderWithProviders(<RequestsPage />)

    expect(await screen.findByText('Leadership · 1 open')).toBeInTheDocument()
  })

  it('filters down to one status', async () => {
    mockApi({ '/requests': REQUESTS })
    const user = userEvent.setup()

    renderWithProviders(<RequestsPage />)
    await screen.findByText('Send us the poster copy')

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      screen.getByText('Instagram post for the winter fundraiser'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Send us the poster copy')).not.toBeInTheDocument()
  })
})

describe('board and request navigation', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('drops the Resources placeholder the request log replaced', () => {
    mockApi({})

    renderWithProviders(
      <Sidebar name="Ada Lovelace" role="member" permissions={['tasks.view_own']} />,
    )

    expect(screen.queryByText('Resources')).not.toBeInTheDocument()
    // Tools is not gone: it moved to its own section with a real page behind
    // it, so only the Leadership placeholder was reclaimed.
    expect(screen.getByText('All tools')).toBeInTheDocument()
  })

  it('still filters on the key, for a caller who somehow lacks it', () => {
    // Every camper holds tasks.view_all and requests.view_all through the
    // Member baseline, so in practice both rows always render. The filter is
    // the mechanism, not the policy — this pins the mechanism.
    mockApi({})

    renderWithProviders(
      <Sidebar name="Ada Lovelace" role="member" permissions={['tasks.view_own']} />,
    )

    expect(screen.queryByText('L2 Board')).not.toBeInTheDocument()
    expect(screen.queryByText('Requests')).not.toBeInTheDocument()
  })

  it('shows both to any camper holding the baseline keys', () => {
    mockApi({})

    renderWithProviders(
      <Sidebar
        name="Ada Lovelace"
        role="member"
        permissions={['tasks.view_all', 'requests.view_all']}
      />,
    )

    expect(screen.getByRole('link', { name: 'L2 Board' })).toHaveAttribute(
      'href',
      '/board',
    )
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute(
      'href',
      '/requests',
    )
  })

  it('gives everyone the Inbox, with the unread count on it', async () => {
    mockApi(
      { '/notifications': { unread: 3, notifications: [] } },
      ['notifications.view_own'],
    )

    renderWithProviders(
      <Sidebar
        name="Ada Lovelace"
        role="member"
        permissions={['notifications.view_own']}
      />,
    )

    const inbox = screen.getByRole('link', { name: /Inbox/ })
    expect(inbox).toHaveAttribute('href', '/inbox')
    await waitFor(() => expect(within(inbox).getByText('3')).toBeInTheDocument())
  })
})
