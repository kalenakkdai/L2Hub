import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeQueryClient } from '../../test/renderWithProviders'
import { PhotographerUploadPage } from './PhotographerUploadPage'

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('PhotographerUploadPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/public/photographer/events')) {
          return reply(200, {
            events: [
              {
                id: 'evt-1',
                name: 'Fall Rally',
                slug: 'fall-rally',
                year: 2026,
                status: 'active',
                startsAt: null,
              },
            ],
          })
        }
        if (url.includes('/public/photographer/options')) {
          return reply(200, {
            permissions: [
              { value: 'instagram', label: 'Instagram' },
              { value: 'yearbook', label: 'Yearbook' },
            ],
          })
        }
        if (
          url.includes('/public/photographer/submissions') &&
          init?.method === 'POST'
        ) {
          return reply(201, {
            submission: {
              id: 'sub-1',
              eventId: 'evt-1',
              eventName: 'Fall Rally',
              creditName: '@msj.lens',
              permission: 'instagram',
              hasDriveLink: true,
              hasFile: false,
              createdAt: '2026-08-10T00:00:00Z',
            },
          })
        }
        return reply(404, { detail: 'missing' })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('submits a Drive link with credit and permission without signing in', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <PhotographerUploadPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Share event photos' }),
    ).toBeInTheDocument()

    await user.selectOptions(
      await screen.findByLabelText(/^Event/),
      'evt-1',
    )
    await user.selectOptions(
      screen.getByLabelText(/^Usage permission/),
      'yearbook',
    )
    await user.type(
      screen.getByLabelText(/How to credit you on Instagram/),
      '@msj.lens',
    )
    await user.type(
      screen.getByLabelText(/Social media link/),
      'https://instagram.com/msj.lens',
    )
    await user.type(
      screen.getByLabelText(/Google Drive link/),
      'https://drive.google.com/drive/folders/abc',
    )
    await user.click(screen.getByRole('button', { name: 'Send photos' }))

    expect(
      await screen.findByRole('heading', { name: 'Photos received' }),
    ).toBeInTheDocument()
    expect(screen.getByText('@msj.lens')).toBeInTheDocument()
    expect(screen.getByText('Fall Rally')).toBeInTheDocument()

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls
      expect(
        calls.some(([url, init]) =>
          String(url).includes('/public/photographer/submissions') &&
          init?.method === 'POST',
        ),
      ).toBe(true)
    })
  })
})
