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
const { SignUpPage } = await import('./SignUpPage')

const mock = supabase as unknown as SupabaseMock

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Brittany')
  await user.type(screen.getByLabelText('Last name'), 'Lu')
  await user.type(screen.getByLabelText('Email'), 'brittany@example.edu')
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
}

async function renderSignUp() {
  const result = renderWithProviders(<SignUpPage />, { route: '/signup' })
  await screen.findByRole('button', { name: 'Create account' })
  return result
}

describe('SignUpPage', () => {
  beforeEach(() => {
    mock.__setSession(null)
    vi.restoreAllMocks()
  })

  it('asks for a first and last name', async () => {
    await renderSignUp()

    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
  })

  it('sends the name as signup metadata so the profile trigger can store it', async () => {
    const user = userEvent.setup()
    await renderSignUp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(mock.auth.signUp).toHaveBeenCalledWith({
        email: 'brittany@example.edu',
        password: 'correct-horse-battery',
        options: {
          data: {
            full_name: 'Brittany Lu',
            first_name: 'Brittany',
            last_name: 'Lu',
          },
        },
      }),
    )
  })

  it('requires every field before calling Supabase', async () => {
    const user = userEvent.setup()
    await renderSignUp()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(mock.auth.signUp).not.toHaveBeenCalled()
  })

  it('rejects a password that is too short', async () => {
    const user = userEvent.setup()
    await renderSignUp()

    await user.type(screen.getByLabelText('First name'), 'Brittany')
    await user.type(screen.getByLabelText('Last name'), 'Lu')
    await user.type(screen.getByLabelText('Email'), 'brittany@example.edu')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(mock.auth.signUp).not.toHaveBeenCalled()
  })

  it('trims stray whitespace out of the stored name', async () => {
    const user = userEvent.setup()
    await renderSignUp()

    await user.type(screen.getByLabelText('First name'), '  Brittany  ')
    await user.type(screen.getByLabelText('Last name'), ' Lu ')
    await user.type(screen.getByLabelText('Email'), 'brittany@example.edu')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(mock.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { data: expect.objectContaining({ full_name: 'Brittany Lu' }) },
        }),
      ),
    )
  })

  it('tells the camper to check their email when confirmation is required', async () => {
    const user = userEvent.setup()
    mock.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    } as never)
    await renderSignUp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('brittany@example.edu')
  })

  it('surfaces a rejected signup', async () => {
    const user = userEvent.setup()
    mock.auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('User already registered'),
    } as never)
    await renderSignUp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered')
  })

  it('sends an already signed-in visitor to the dashboard', async () => {
    mock.__setSession(makeSession())

    renderWithProviders(<SignUpPage />, { route: '/signup' })

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument(),
    )
  })
})
