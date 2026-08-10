import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DashboardSearch } from './DashboardSearch'

vi.mock('../../hooks/useCampsiteModules', () => ({
  useCampsiteChrome: () => ({ data: { modulesEnabled: {} } }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderSearch(permissions: string[] = ['note_taker.view']) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardSearch permissions={permissions} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardSearch', () => {
  it('navigates to a matched implemented page', async () => {
    const user = userEvent.setup()
    renderSearch()

    const input = screen.getByRole('combobox', { name: 'Search pages' })
    await user.click(input)
    await user.type(input, 'note')
    await user.click(screen.getByRole('option', { name: /Note Taker/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/note-taker')
  })

  it('does not navigate to Soon destinations', async () => {
    const user = userEvent.setup()
    renderSearch()

    const input = screen.getByRole('combobox', { name: 'Search pages' })
    await user.click(input)
    await user.type(input, 'my tasks')
    expect(screen.getByRole('option', { name: /My tasks/i })).toBeDisabled()
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })
})
