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
              account_linked: true,
            },
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              email: '',
              full_name: 'Hanna Rahmanian',
              status: 'awaiting_signup',
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
                {
                  slug: 'committee_head',
                  name: 'Committee Head',
                  rank: 50,
                  scope: 'committee',
                  committee_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  event_id: null,
                  committee_name: 'Activities',
                },
              ],
              committees: [
                {
                  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  slug: 'activities',
                  name: 'Activities',
                  is_head: true,
                  membership_type: 'head',
                },
              ],
              last_active_at: null,
              created_at: '2026-01-01T00:00:00Z',
              account_linked: false,
            },
            {
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              email: '',
              full_name: 'Kaiwei Parks',
              status: 'awaiting_signup',
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
                {
                  slug: 'committee_head',
                  name: 'Committee Head',
                  rank: 50,
                  scope: 'committee',
                  committee_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  event_id: null,
                  committee_name: 'Activities',
                },
              ],
              committees: [
                {
                  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  slug: 'activities',
                  name: 'Activities',
                  is_head: true,
                  membership_type: 'head',
                },
              ],
              last_active_at: null,
              created_at: '2026-01-01T00:00:00Z',
              account_linked: false,
            },
          ],
        },
      },
    })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByRole('heading', { name: 'Campers' })).toBeInTheDocument()
    expect(await screen.findByText('Taylor Kim')).toBeInTheDocument()
    expect(screen.getByText('Hanna Rahmanian')).toBeInTheDocument()
    expect(screen.getByText('Kaiwei Parks')).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting signup').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('No account yet').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('ASBO').length).toBeGreaterThanOrEqual(1)
    // Co-heads both show Head in the committee column.
    expect(screen.getAllByText('Activities · Head')).toHaveLength(2)
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

    expect(await screen.findByText('Campers is restricted')).toBeInTheDocument()
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
              account_linked: true,
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
