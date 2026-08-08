import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import { makeQueryClient } from '../../test/renderWithProviders'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>(
      '../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { AuthProvider } = await import('../../auth/AuthProvider')
const { Sidebar } = await import('./Sidebar')
const { MobileNavigation } = await import('./MobileNavigation')

const mock = supabase as unknown as SupabaseMock

function renderChrome(ui: React.ReactElement, route = '/dashboard') {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => mock.__setSession(makeSession()))

  it('is a labelled navigation landmark', () => {
    renderChrome(<Sidebar name="Ada Lovelace" role="asbo" />)

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('marks the current route as the active page', () => {
    renderChrome(<Sidebar name="Ada Lovelace" role="asbo" />)

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders unbuilt destinations as inert rows, not dead links', () => {
    renderChrome(<Sidebar name="Ada Lovelace" role="asbo" />)

    // "My tasks" has no route yet, so it must not be a link.
    expect(screen.queryByRole('link', { name: /My tasks/ })).not.toBeInTheDocument()
    expect(screen.getByText('My tasks')).toBeInTheDocument()
  })

  it('shows the member and their role', () => {
    renderChrome(<Sidebar name="Ada Lovelace" role="committee_head" />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Committee Head')).toBeInTheDocument()
  })

  it('signs out from the user menu', async () => {
    const user = userEvent.setup()
    renderChrome(<Sidebar name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(mock.auth.signOut).toHaveBeenCalled()
  })
})

describe('MobileNavigation', () => {
  beforeEach(() => mock.__setSession(makeSession()))

  it('keeps the drawer closed until asked', () => {
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('opens a labelled dialog containing the same destinations', async () => {
    const user = userEvent.setup()
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    expect(within(drawer).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('moves focus into the drawer when it opens', async () => {
    const user = userEvent.setup()
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes after choosing a destination', async () => {
    const user = userEvent.setup()
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('locks background scrolling while open and restores it after', async () => {
    const user = userEvent.setup()
    renderChrome(<MobileNavigation name="Ada Lovelace" role="asbo" />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
