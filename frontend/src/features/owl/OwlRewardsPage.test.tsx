import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeQueryClient } from '../../test/renderWithProviders'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import {
  GradebookProvider,
  MockGradebookAuthProvider,
  MockGradebookCommandProvider,
  MockGradebookDataProvider,
} from '../grades'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>(
      '../../test/supabaseMock',
    )
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { AuthProvider } = await import('../../auth/AuthProvider')
const { OwlRewardsPage } = await import('./OwlRewardsPage')

const mock = supabase as unknown as SupabaseMock

const CATALOG = {
  bellyColors: [
    { id: 'snow', label: 'Snow', cost: 0, fill: '#fff', fillDeep: '#ddd' },
    { id: 'gold', label: 'Gold', cost: 40, fill: '#ff0', fillDeep: '#aa0' },
  ],
  wingColors: [
    { id: 'mist', label: 'Mist', cost: 0, near: '#ddd', far: '#bbb' },
  ],
  accessories: [{ id: 'none', label: 'None', cost: 0 }],
  trails: [{ id: 'none', label: 'None', cost: 0 }],
  aPlusMinPercent: 97,
  welcomePoints: 100,
}

function owlBody(overrides: Record<string, unknown> = {}) {
  return {
    points: 100,
    eligible: true,
    accessActive: true,
    weightedPercent: 98,
    letterGrade: 'A+',
    cosmetics: {
      bellyColor: 'snow',
      wingColor: 'mist',
      accessory: 'none',
      trail: 'none',
      unlocked: [],
      palette: {
        belly: CATALOG.bellyColors[0],
        wing: CATALOG.wingColors[0],
      },
    },
    catalog: CATALOG,
    accessRevokedAt: null,
    ...overrides,
  }
}

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('OwlRewardsPage', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/auth/me')) {
          return reply(200, {
            id: 'me',
            email: 'ada@msjhs.org',
            full_name: 'Ada Lovelace',
            role: 'member',
            created_at: '2026-01-01T00:00:00Z',
            permissions: ['grades.view_own'],
            roles: [],
          })
        }
        if (url.includes('/owl/eligibility/sync') && init?.method === 'POST') {
          return reply(200, owlBody({ change: { unlocked: true, revoked: false, letter: 'A+', percent: 98 } }))
        }
        if (url.includes('/owl/me')) {
          return reply(200, owlBody())
        }
        if (url.includes('/owl/cosmetics') && init?.method === 'PATCH') {
          return reply(
            200,
            owlBody({
              points: 60,
              cosmetics: {
                ...owlBody().cosmetics,
                bellyColor: 'gold',
                unlocked: ['bellyColor:gold'],
                palette: {
                  belly: CATALOG.bellyColors[1],
                  wing: CATALOG.wingColors[0],
                },
              },
            }),
          )
        }
        return reply(404, { detail: 'missing' })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderPage() {
    const data = new MockGradebookDataProvider()
    return render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <GradebookProvider
              dataProvider={data}
              commandProvider={new MockGradebookCommandProvider(data)}
              authProvider={new MockGradebookAuthProvider(['gradebook.view_own'])}
            >
              <OwlRewardsPage />
            </GradebookProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('lets an A+ student spend points on cosmetics', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'My owl' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/100 pts/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Gold/ }))
    await user.click(screen.getByRole('button', { name: /Apply/ }))

    await waitFor(() => {
      expect(screen.getByText(/60 pts/)).toBeInTheDocument()
    })
  })
})
