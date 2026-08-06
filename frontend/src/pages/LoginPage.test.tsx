import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type SupabaseMock } from '../test/supabaseMock'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../test/supabaseMock')>('../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../lib/supabase')
const { LoginPage } = await import('./LoginPage')

const mock = supabase as unknown as SupabaseMock

async function renderLogin() {
  const result = renderWithProviders(<LoginPage />, { route: '/login' })
  await screen.findByRole('button', { name: 'Sign in' })
  return result
}

describe('LoginPage', () => {
  beforeEach(() => {
    mock.__setSession(null)
    vi.restoreAllMocks()
  })

  it('renders the email and password form', async () => {
    await renderLogin()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('signs in with the submitted credentials', async () => {
    const user = userEvent.setup()
    await renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ada@example.edu')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'ada@example.edu',
        password: 'correct-horse',
      }),
    )
  })

  it('requires both fields before calling Supabase', async () => {
    const user = userEvent.setup()
    await renderLogin()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(mock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows the error when the credentials are rejected', async () => {
    const user = userEvent.setup()
    mock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error('Invalid login credentials'),
    } as never)
    await renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ada@example.edu')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  })

  it('stays on the form after a failed attempt', async () => {
    const user = userEvent.setup()
    mock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error('Invalid login credentials'),
    } as never)
    await renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ada@example.edu')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('does not show an expired-session notice on a normal visit', async () => {
    await renderLogin()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // The expired-session notice is driven by an expired sign-out originating
  // on the dashboard, so it is covered end to end in AppRoutes.test.tsx.
})
