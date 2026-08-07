import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSession, type SupabaseMock } from '../../../test/supabaseMock'
import { renderWithProviders } from '../../../test/renderWithProviders'

vi.mock('../../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../../test/supabaseMock')>(
      '../../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../../lib/supabase')
const { UsersPage } = await import('./UsersPage')

const mock = supabase as unknown as SupabaseMock

function mockApiByUrl(handlers: Record<string, { status?: number; body: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const match = Object.entries(handlers)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => url.includes(path))
    if (!match) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: `No mock for ${url}` }),
      } as Response
    }
    const [, entry] = match
    const status = entry.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => entry.body,
    } as Response
  })
}

describe('UsersPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('shows the roster for accounts with users.view', async () => {
    mockApiByUrl({
      '/auth/me': {
        body: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'ac@l2hub.local',
          full_name: 'Mr. Jan',
          role: 'ac',
          created_at: '2026-01-01T00:00:00Z',
          permissions: ['users.view', 'users.manage'],
        },
      },
      '/admin/users': {
        body: {
          users: [
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              email: 'asbo@l2hub.local',
              full_name: 'Taylor Kim',
              status: 'active',
              primary_role: 'asbo',
              roles: [
                {
                  slug: 'asbo',
                  name: 'ASBO',
                  rank: 80,
                  scope: 'global',
                  committee_id: null,
                  event_id: null,
                },
              ],
              committees: [],
              last_active_at: null,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      },
    })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(await screen.findByText('Taylor Kim')).toBeInTheDocument()
    expect(screen.getByText('ASBO')).toBeInTheDocument()
  })

  it('blocks accounts without users.view', async () => {
    mockApiByUrl({
      '/auth/me': {
        body: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          email: 'member@l2hub.local',
          full_name: 'Avery Chen',
          role: 'member',
          created_at: '2026-01-01T00:00:00Z',
          permissions: ['grades.view_own'],
        },
      },
    })

    renderWithProviders(<UsersPage />)

    expect(
      await screen.findByText('Users administration is restricted'),
    ).toBeInTheDocument()
  })

  it('opens the detail drawer from a roster row', async () => {
    const user = userEvent.setup()
    mockApiByUrl({
      '/auth/me': {
        body: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'ac@l2hub.local',
          full_name: 'Mr. Jan',
          role: 'ac',
          created_at: '2026-01-01T00:00:00Z',
          permissions: ['users.view'],
        },
      },
      '/admin/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': {
        body: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          email: 'asbo@l2hub.local',
          full_name: 'Taylor Kim',
          status: 'active',
          primary_role: 'asbo',
          roles: [],
          committees: [],
          last_active_at: null,
          created_at: '2026-01-01T00:00:00Z',
          effective_permissions: ['grades.view_all'],
          global_roles: [
            {
              slug: 'asbo',
              name: 'ASBO',
              rank: 80,
              scope: 'global',
              committee_id: null,
              event_id: null,
            },
          ],
          scoped_roles: [],
        },
      },
      '/admin/users': {
        body: {
          users: [
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              email: 'asbo@l2hub.local',
              full_name: 'Taylor Kim',
              status: 'active',
              primary_role: 'asbo',
              roles: [],
              committees: [],
              last_active_at: null,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      },
    })

    renderWithProviders(<UsersPage />)
    await screen.findByText('Taylor Kim')
    await user.click(screen.getByText('Taylor Kim'))
    expect(await screen.findByLabelText('User details')).toBeInTheDocument()
    expect(screen.getByText('grades.view_all')).toBeInTheDocument()
  })
})
