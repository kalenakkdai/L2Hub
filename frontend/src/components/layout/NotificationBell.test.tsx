import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { makeQueryClient } from '../../test/renderWithProviders'
import { NotificationBell } from './NotificationBell'

const fetchMock = vi.fn()

vi.mock('../../features/event-summary/api', () => ({
  fetchNotifications: () => fetchMock(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

function renderBell() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      unread: 1,
      notifications: [
        {
          id: 'n1',
          type: 'request.received',
          title: 'Ariel Duong requested Winter fundraiser',
          body: 'Community → Spirit',
          payload: { requestId: 'r1' },
          readAt: null,
          createdAt: '2026-08-10T17:00:00Z',
        },
      ],
    })
  })

  it('opens a tiny notifications tab when the bell is pressed', async () => {
    const user = userEvent.setup()
    renderBell()

    const bell = await screen.findByRole('button', { name: /Notifications, 1 unread/i })
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument()

    await user.click(bell)

    const panel = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(panel).toBeInTheDocument()
    expect(
      await screen.findByText('Ariel Duong requested Winter fundraiser'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open full inbox' })).toHaveAttribute(
      'href',
      '/inbox',
    )
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole('button', { name: /Notifications/i }))
    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument()
    })
  })
})
