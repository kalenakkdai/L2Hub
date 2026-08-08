import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSession, type SupabaseMock } from '../test/supabaseMock'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../test/supabaseMock')>('../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../lib/supabase')
const { DashboardPage } = await import('./DashboardPage')

const mock = supabase as unknown as SupabaseMock

function mockApi(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.edu',
    full_name: 'Ada Lovelace',
    role: 'asbo',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('shows the name and role from /auth/me', async () => {
    mockApi(profile())

    // The sidebar carries the full name and the role; the page heading
    // greets by first name.
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ada')
    expect(screen.getByText('ASBO')).toBeInTheDocument()
  })

  it('requests /auth/me with the bearer token', async () => {
    const fetchSpy = mockApi(profile())

    renderWithProviders(<DashboardPage />)
    await screen.findByText('Ada Lovelace')

    const [url, init] = fetchSpy.mock.calls[0]
    const headers = init?.headers as Record<string, string> | undefined
    expect(url).toBe('http://127.0.0.1:8000/auth/me')
    expect(headers?.Authorization).toBe('Bearer test-access-token')
  })

  it.each([
    ['member', 'Member'],
    ['committee_head', 'Crew Head'],
    ['asbo', 'ASBO'],
    ['ac', 'AC'],
    ['president', 'President'],
  ])('renders the %s role as "%s"', async (role, label) => {
    mockApi(profile({ role }))

    renderWithProviders(<DashboardPage />)

    await screen.findByText('Ada Lovelace')
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('falls back to the email when no name is set', async () => {
    mockApi(profile({ full_name: null }))

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('ada@example.edu')).toBeInTheDocument()
  })

  it('shows a loading state before the profile arrives', () => {
    mockApi(profile())

    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Loading your profile…')).toBeInTheDocument()
  })

  it('reports a non-auth failure without signing the user out', async () => {
    mockApi({ detail: 'No profile exists for this user.' }, 404)

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No profile exists for this user.',
    )
    expect(mock.auth.signOut).not.toHaveBeenCalled()
  })

  it('signs out when the log out button is pressed', async () => {
    const user = userEvent.setup()
    mockApi(profile())

    renderWithProviders(<DashboardPage />)
    await screen.findByText('Ada Lovelace')

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(mock.auth.signOut).toHaveBeenCalled())
  })

  it('signs the user out when the backend rejects their token', async () => {
    mockApi({ detail: 'Token rejected' }, 401)

    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(mock.auth.signOut).toHaveBeenCalled())
  })

  it('does not show a raw error when the session expired', async () => {
    mockApi({ detail: 'Token rejected' }, 401)

    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(mock.auth.signOut).toHaveBeenCalled())
    // The user is being redirected to the login page; a red error box here
    // would be noise on the way out.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
