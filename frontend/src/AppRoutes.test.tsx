import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSession, type SupabaseMock } from './test/supabaseMock'
import { renderWithProviders } from './test/renderWithProviders'

vi.mock('./lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('./test/supabaseMock')>('./test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('./lib/supabase')
const { AppRoutes } = await import('./AppRoutes')

const mock = supabase as unknown as SupabaseMock

function mockApi(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    let payload: unknown = body
    if (url.includes('/dashboard') && !url.includes('/auth/dashboard')) {
      payload = {
        committee: null,
        campsiteCount: 0,
        stats: { gradeLetter: null, gradePercent: null, openCount: 0 },
        nextEvent: null,
        calendar: [],
        attention: [],
        grades: {
          completed: 0,
          missing: 0,
          open: 0,
          pointsEarned: 0,
          pointsPossible: 0,
          rows: [],
        },
        progress: {
          gradeLetter: null,
          gradePercent: null,
          nextBand: null,
          nextBandMin: null,
          streakWeeks: 0,
          tasksDone: 0,
          participationRate: 0,
          note: null,
        },
        activity: [],
        committeeSnapshot: null,
        liveDebrief: null,
        upcoming: [],
      }
    } else if (url.includes('/grades/me')) {
      payload = {
        entries: [],
        summary: {},
        categories: [],
        student: { id: PROFILE.id, name: PROFILE.full_name },
      }
    } else if (url.includes('/auth/me') || url.endsWith('/me')) {
      payload = { ...PROFILE, permissions: [] }
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as Response
  })
}

const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.edu',
  full_name: 'Ada Lovelace',
  role: 'asbo',
  created_at: '2026-01-01T00:00:00Z',
}

describe('routing', () => {
  beforeEach(() => {
    mock.__setSession(null)
    vi.restoreAllMocks()
  })

  describe('/', () => {
    it('sends unauthenticated visitors to the login page', async () => {
      renderWithProviders(<AppRoutes />, { route: '/' })

      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('sends authenticated visitors to the dashboard', async () => {
      mock.__setSession(makeSession())
      mockApi(PROFILE)

      renderWithProviders(<AppRoutes />, { route: '/' })

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    })
  })

  describe('/dashboard', () => {
    it('redirects unauthenticated visitors to the login page', async () => {
      renderWithProviders(<AppRoutes />, { route: '/dashboard' })

      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('renders for authenticated visitors', async () => {
      mock.__setSession(makeSession())
      mockApi(PROFILE)

      renderWithProviders(<AppRoutes />, { route: '/dashboard' })

      expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })
  })

  describe('/login', () => {
    it('redirects authenticated visitors to the dashboard', async () => {
      mock.__setSession(makeSession())
      mockApi(PROFILE)

      renderWithProviders(<AppRoutes />, { route: '/login' })

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    })

    it('returns the user to the page they were bounced from after signing in', async () => {
      const user = userEvent.setup()
      mockApi(PROFILE)

      renderWithProviders(<AppRoutes />, { route: '/dashboard' })

      // Bounced to login...
      await screen.findByRole('button', { name: 'Sign in' })

      await user.type(screen.getByLabelText('Email'), 'ada@example.edu')
      await user.type(screen.getByLabelText('Password'), 'correct-horse')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      // ...and back to the dashboard once signed in.
      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    })
  })

  describe('expired session', () => {
    it('sends the user to the login page with an explanation', async () => {
      mock.__setSession(makeSession())
      mockApi({ detail: 'Token rejected' }, 401)

      renderWithProviders(<AppRoutes />, { route: '/dashboard' })

      // The rejected token signs them out, which bounces them to /login...
      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
      // ...with a reason, rather than an unexplained login screen.
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Your session expired. Please sign in again.',
      )
    })

    it('drops cached data belonging to the previous session', async () => {
      mock.__setSession(makeSession())
      mockApi({ detail: 'Token rejected' }, 401)

      const { queryClient } = renderWithProviders(<AppRoutes />, { route: '/dashboard' })
      queryClient.setQueryData(['secret'], 'previous user data')

      await screen.findByRole('button', { name: 'Sign in' })

      expect(queryClient.getQueryData(['secret'])).toBeUndefined()
    })

    it('clears the expired notice once the user signs in again', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      mockApi({ detail: 'Token rejected' }, 401)

      renderWithProviders(<AppRoutes />, { route: '/dashboard' })
      await screen.findByRole('status')

      mockApi(PROFILE)
      await user.type(screen.getByLabelText('Email'), 'ada@example.edu')
      await user.type(screen.getByLabelText('Password'), 'correct-horse')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('logout', () => {
    it('returns the user to the login page', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      mockApi(PROFILE)

      renderWithProviders(<AppRoutes />, { route: '/dashboard' })
      await screen.findByText('Ada Lovelace')

      await user.click(screen.getByRole('button', { name: 'Log out' }))

      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
      // A deliberate logout is not an expiry, so no notice.
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('/dev/health', () => {
    it('is reachable without signing in', async () => {
      mockApi({ status: 'ok' })

      renderWithProviders(<AppRoutes />, { route: '/dev/health' })

      expect(await screen.findByText(/Connected — status: ok/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    })

    it('reports an unreachable backend instead of failing silently', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'))

      renderWithProviders(<AppRoutes />, { route: '/dev/health' })

      await waitFor(() =>
        expect(screen.getByText(/Could not reach backend/)).toBeInTheDocument(),
      )
    })
  })

  describe('/photographer', () => {
    it('is reachable without signing in', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input)
        if (url.includes('/public/photographer/events')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ events: [] }),
          } as Response
        }
        if (url.includes('/public/photographer/options')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ permissions: [] }),
          } as Response
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response
      })

      renderWithProviders(<AppRoutes />, { route: '/photographer' })

      expect(
        await screen.findByRole('heading', { name: 'Share event photos' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    })
  })
})
