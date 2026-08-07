import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../test/supabaseMock'
import { makeQueryClient } from '../test/renderWithProviders'

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../test/supabaseMock')>('../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../lib/supabase')
const { AuthProvider } = await import('./AuthProvider')
const { useAuth } = await import('./useAuth')

const mock = supabase as unknown as SupabaseMock

function Probe() {
  const { status, session, sessionExpired, signOut } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="token">{session?.access_token ?? 'none'}</p>
      <p data-testid="expired">{String(sessionExpired)}</p>
      <button type="button" onClick={() => void signOut('manual')}>
        manual
      </button>
      <button type="button" onClick={() => void signOut('expired')}>
        expired
      </button>
    </div>
  )
}

function renderProbe() {
  const queryClient = makeQueryClient()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient, ...result }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mock.__setSession(null)
    vi.restoreAllMocks()
  })

  it('starts in a loading state so the UI does not flash the login page', async () => {
    renderProbe()

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    )
  })

  it('restores a persisted session on mount', async () => {
    mock.__setSession(makeSession({ access_token: 'persisted-token' }))

    renderProbe()

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )
    expect(screen.getByTestId('token')).toHaveTextContent('persisted-token')
  })

  it('falls back to unauthenticated when the session cannot be read', async () => {
    mock.auth.getSession.mockRejectedValueOnce(new Error('storage unavailable'))

    renderProbe()

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    )
  })

  it('follows auth state changes emitted by the Supabase client', async () => {
    renderProbe()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    )

    mock.__emit('SIGNED_IN', makeSession({ access_token: 'fresh-token' }))

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )
    expect(screen.getByTestId('token')).toHaveTextContent('fresh-token')
  })

  describe('signOut', () => {
    it('calls Supabase signOut and clears the query cache', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      const { queryClient } = renderProbe()
      queryClient.setQueryData(['auth', 'me'], { role: 'asbo' })

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
      )
      await user.click(screen.getByRole('button', { name: 'manual' }))

      expect(mock.auth.signOut).toHaveBeenCalled()
      await waitFor(() =>
        expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined(),
      )
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    })

    it('flags an expired sign-out so the login page can explain', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      renderProbe()

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
      )
      await user.click(screen.getByRole('button', { name: 'expired' }))

      await waitFor(() => expect(screen.getByTestId('expired')).toHaveTextContent('true'))
    })

    it('does not flag a deliberate sign-out as expired', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      renderProbe()

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
      )
      await user.click(screen.getByRole('button', { name: 'manual' }))

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
      )
      expect(screen.getByTestId('expired')).toHaveTextContent('false')
    })

    it('clears local state even when the network sign-out fails', async () => {
      const user = userEvent.setup()
      mock.__setSession(makeSession())
      mock.auth.signOut.mockRejectedValueOnce(new Error('offline'))
      const { queryClient } = renderProbe()
      queryClient.setQueryData(['auth', 'me'], { role: 'asbo' })

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
      )
      await user.click(screen.getByRole('button', { name: 'manual' }))

      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
      )
      expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined()
    })
  })

  it('clears cached data when Supabase signs the user out on its own', async () => {
    // What happens when a refresh token can no longer be renewed.
    mock.__setSession(makeSession())
    const { queryClient } = renderProbe()
    queryClient.setQueryData(['auth', 'me'], { role: 'asbo' })

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )

    mock.__emit('SIGNED_OUT', null)

    await waitFor(() => expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined())
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
  })

  it('unsubscribes from auth changes on unmount', async () => {
    const { unmount } = renderProbe()
    await waitFor(() => expect(mock.auth.onAuthStateChange).toHaveBeenCalled())

    unmount()

    // Emitting after unmount must not touch React state (no act() warning).
    expect(() => mock.__emit('SIGNED_IN', makeSession())).not.toThrow()
  })
})
