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

/**
 * A route that refuses instead of answering.
 *
 * A sentinel rather than a bare `status` key, because a fixture could
 * legitimately have a field by that name.
 */
function failure(status: number, detail = 'Denied.') {
  return { __failure: { status, detail } }
}

/** Answers each endpoint by URL, and records what was posted. */
function mockApi(
  routes: Record<string, unknown>,
  permissions = ['tasks.view_all', 'requests.view_all'],
) {
  const posted: { url: string; body: unknown }[] = []
  const requested: string[] = []

  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = String(input)
      requested.push(url)
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

      const refusal = (body as { __failure?: { status: number; detail: string } })
        .__failure
      if (refusal) {
        return {
          ok: false,
          status: refusal.status,
          json: async () => ({ detail: refusal.detail }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as Response
    })

  return { spy, posted, requested }
}

/** A YYYY-MM-DD stamp `days` from today, so fixtures never go stale. */
function stamp(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
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

// ---------------------------------------------------------------------------
// Layout, deadlines, and who has a task
// ---------------------------------------------------------------------------

const ROSTER = {
  committeeId: FUNDRAISING,
  committeeSlug: 'fundraising',
  committeeName: 'Fundraising',
  members: [
    { id: 'u2', name: 'Blake Ito', position: 'Head', isHead: true, avatarUrl: null },
    { id: 'u1', name: 'Avery Chen', position: null, isHead: false, avatarUrl: null },
  ],
}

/** A board with enough shape to exercise both layouts. */
function board() {
  return {
    committees: [
      {
        ...BOARD.committees[0],
        openRequestCount: 1,
        tasks: [
          { ...BOARD.committees[0].tasks[0], dueOn: stamp(-3) },
          {
            id: 't2',
            committeeId: FUNDRAISING,
            title: 'Count the float',
            details: '',
            status: 'done',
            assignee: null,
            dueOn: stamp(-40),
            createdAt: '2026-08-01T00:00:00Z',
          },
          {
            id: 't3',
            committeeId: FUNDRAISING,
            title: 'Book the hall',
            details: '',
            status: 'doing',
            assignee: null,
            dueOn: stamp(60),
            createdAt: '2026-08-01T00:00:00Z',
          },
        ],
      },
      BOARD.committees[1],
    ],
  }
}

describe('choosing how the board is laid out', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('starts on the side-by-side columns', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByRole('heading', { name: 'Fundraising' })
    expect(screen.getByRole('button', { name: 'Expanded' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Nothing is collapsed, so every task is on the page already.
    expect(screen.getByText('Winter fundraiser')).toBeInTheDocument()
  })

  it('reads the layout out of the address so a link can be shared', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    renderWithProviders(<L2BoardPage />, { route: '/board?view=compact' })

    await screen.findByRole('button', { name: /Fundraising/ })
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches to one collapsible row per committee', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByRole('heading', { name: 'Fundraising' })
    await user.click(screen.getByRole('button', { name: 'Compact' }))

    expect(screen.getByRole('button', { name: /Fundraising/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

describe('the compact board', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  async function compact() {
    mockApi({ '/board': board(), '/board/committees': PICKER, '/members': ROSTER })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board?view=compact' })
    await screen.findByRole('button', { name: /Fundraising/ })
    return user
  }

  it('shows every committee at once with its tasks hidden', async () => {
    await compact()

    expect(screen.getByRole('button', { name: /Fundraising/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publicity/ })).toBeInTheDocument()
    // Collapsed content is `hidden`, so it is out of the accessibility tree
    // rather than merely out of sight.
    expect(screen.queryByText('Winter fundraiser')).not.toBeVisible()
  })

  it('opens a committee in place when its row is pressed', async () => {
    const user = await compact()

    await user.click(screen.getByRole('button', { name: /Fundraising/ }))

    expect(screen.getByRole('button', { name: /Fundraising/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('Winter fundraiser')).toBeVisible()
  })

  it('lets two committees be open at the same time', async () => {
    const user = await compact()

    await user.click(screen.getByRole('button', { name: /Fundraising/ }))
    await user.click(screen.getByRole('button', { name: /Publicity/ }))

    expect(screen.getByRole('button', { name: /Fundraising/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: /Publicity/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('summarises what is done without opening the row', async () => {
    await compact()

    const row = screen.getByRole('button', { name: /Fundraising/ })
    expect(row).toHaveTextContent('3 tasks')
    expect(row).toHaveTextContent('1 in progress')
    expect(row).toHaveTextContent('1 done')
  })

  it('warns on the row when a committee has something overdue', async () => {
    await compact()

    // One task is three days past due; the finished one, forty days past, is
    // not late at all.
    expect(screen.getByRole('button', { name: /Fundraising/ })).toHaveTextContent(
      '1 overdue',
    )
  })

  it('still says a committee with no tasks has none', async () => {
    const user = await compact()

    await user.click(screen.getByRole('button', { name: /Publicity/ }))

    expect(screen.getByRole('button', { name: /Publicity/ })).toHaveTextContent(
      'No tasks',
    )
    expect(screen.getByText('Nothing on the board.')).toBeVisible()
  })

  it('offers Add task only on the committees the caller may write to', async () => {
    await compact()

    expect(screen.getAllByRole('button', { name: 'Add task' })).toHaveLength(1)
  })

  it('opens every row at once', async () => {
    const user = await compact()

    await user.click(screen.getByRole('button', { name: 'Expand all' }))

    expect(screen.getByText('Winter fundraiser')).toBeVisible()
    expect(screen.getByRole('button', { name: /Publicity/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    // The control now offers the way back.
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument()
  })
})

describe('deadlines on the board', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('marks a task past its due date as overdue, in words', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')
    expect(screen.getByText(/^Overdue ·/)).toBeInTheDocument()
  })

  it('does not call a finished task overdue', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Count the float')
    // Forty days past due, but done: exactly one overdue label on the page.
    expect(screen.getAllByText(/^Overdue ·/)).toHaveLength(1)
  })

  it('leaves a distant deadline as a plain date', async () => {
    mockApi({ '/board': board(), '/board/committees': PICKER })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Book the hall')
    expect(screen.getByText(/^due /)).toBeInTheDocument()
  })
})

describe('who has a task', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('does not ask a committee for its roster until it is needed', async () => {
    const api = mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': ROSTER,
    })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')

    expect(api.requested.some((url) => url.endsWith('/members'))).toBe(false)
  })

  it('sends the chosen assignee when the task is created', async () => {
    const api = mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': ROSTER,
    })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByRole('heading', { name: 'Fundraising' })
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Task' }), 'Bake sale')
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Assignee' }),
      'u1',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save without help' }))

    await waitFor(() => {
      const posted = api.posted.find((p) => p.url.endsWith('/board/tasks'))
      expect(posted?.body).toMatchObject({ title: 'Bake sale', assigneeUserId: 'u1' })
    })
  })

  it('moves a task to someone else from the board', async () => {
    const api = mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': ROSTER,
    })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')
    await user.click(screen.getByRole('button', { name: /Winter fundraiser — assigned to/ }))

    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Assigned to' }),
      'u2',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patched = api.posted.find((p) => p.url.includes('/board/tasks/t1'))
      expect(patched?.body).toMatchObject({ assigneeUserId: 'u2' })
    })
  })

  it('clears the assignee when Unassigned is picked', async () => {
    const api = mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': ROSTER,
    })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')
    await user.click(screen.getByRole('button', { name: /Winter fundraiser — assigned to/ }))

    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Assigned to' }),
      '',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patched = api.posted.find((p) => p.url.includes('/board/tasks/t1'))
      expect(patched?.body).toMatchObject({ clearAssignee: true })
    })
  })

  it('keeps the current holder in the list after they leave the committee', async () => {
    // Avery holds t1 but is no longer on the roster. Without them in the
    // options the select would match nothing, fall back to the empty option,
    // and Save would quietly unassign a task the user was only looking at.
    mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': { ...ROSTER, members: [ROSTER.members[0]] },
    })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')
    await user.click(screen.getByRole('button', { name: /Winter fundraiser — assigned to/ }))

    const dialog = await screen.findByRole('dialog')
    const select = await within(dialog).findByRole('combobox', { name: 'Assigned to' })
    expect(select).toHaveValue('u1')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('says only heads can reassign when the roster is refused', async () => {
    mockApi({
      '/board': board(),
      '/board/committees': PICKER,
      '/members': failure(403),
    })
    const user = userEvent.setup()
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Winter fundraiser')
    await user.click(screen.getByRole('button', { name: /Winter fundraiser — assigned to/ }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText(/Only committee heads can change who has this/),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Assigned to' })).toBeDisabled()
  })

  it('offers no way to reassign on a committee the caller cannot write to', async () => {
    const withTask = board()
    withTask.committees[1] = {
      ...withTask.committees[1],
      tasks: [
        {
          id: 'p1',
          committeeId: PUBLICITY,
          title: 'Post the reel',
          details: '',
          status: 'todo',
          assignee: { id: 'u9', name: 'Sam Reed' },
          dueOn: stamp(30),
          createdAt: '2026-08-01T00:00:00Z',
        },
      ],
    }
    mockApi({ '/board': withTask, '/board/committees': PICKER, '/members': ROSTER })
    renderWithProviders(<L2BoardPage />, { route: '/board' })

    await screen.findByText('Post the reel')
    // Sam's name is still shown — it is just not a control.
    expect(screen.getByText('Sam Reed')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Post the reel — assigned to/ }),
    ).not.toBeInTheDocument()
  })
})
