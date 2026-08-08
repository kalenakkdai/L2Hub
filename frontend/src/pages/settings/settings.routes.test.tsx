import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSession, type SupabaseMock } from '../../test/supabaseMock'
import { renderWithProviders } from '../../test/renderWithProviders'

/**
 * Route tests that assert the settings pages actually render.
 *
 * A dev server returning 200 for /settings proves nothing in a single-page
 * app — Vite serves index.html for every path, matched route or not. These
 * mount the real route table and look for content only the settings
 * components produce.
 */

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>('../../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('../../lib/supabase')
const { AppRoutes } = await import('../../AppRoutes')
const { AppearanceEffect } = await import('../../components/AppearanceEffect')

const mock = supabase as unknown as SupabaseMock

const PROFILE_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ada@example.edu',
  full_name: 'Ada Lovelace',
  display_name: null,
  pronouns: null,
  grade_year: 11,
  avatar_url: null,
  phone: null,
  phone_verified: false,
  email_verified: true,
  theme: 'system',
  reduce_motion: false,
  compact_density: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  notifications_paused: false,
}

const CAMPSITE_ROW = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'L2 Campsite',
  tagline: null,
  category: null,
  icon: null,
  accent_color: '#12372A',
  modules_enabled: { grades: true, events: true },
  join_code: null,
  requires_approval: true,
  is_public: true,
  points_config: {
    debrief_submitted: 20,
    event_attended: 10,
    task_completed: 5,
    points_per_level: 200,
  },
}

/**
 * Serves the rows each settings page reads, and *remembers writes*.
 *
 * A stub that always replays its initial row would hide the refetch after a
 * save overwriting an optimistic update, so it has to behave like a database
 * and reflect what was written.
 */
function stubTables() {
  const rows: Record<string, Record<string, unknown>> = {
    profiles: { ...PROFILE_ROW },
    campsite_settings: { ...CAMPSITE_ROW },
  }

  mock.from = vi.fn((table: string) => {
    const empty = Promise.resolve({ data: [], error: null })
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: rows[table] ?? null, error: null })),
      upsert: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn((patch: Record<string, unknown>) => {
        if (rows[table]) Object.assign(rows[table], patch)
        return builder
      }),
      then: empty.then.bind(empty),
      catch: empty.catch.bind(empty),
      finally: empty.finally.bind(empty),
    }
    return builder
  }) as unknown as SupabaseMock['from']
}

function mockAccount(permissions: string[]) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      id: PROFILE_ROW.id,
      email: PROFILE_ROW.email,
      full_name: PROFILE_ROW.full_name,
      role: 'asbo',
      created_at: '2026-01-01T00:00:00Z',
      permissions,
      roles: [],
    }),
  } as Response)
}

describe('/settings', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    stubTables()
  })

  it('renders My settings, not just a 200', async () => {
    mockAccount([])

    renderWithProviders(<AppRoutes />, { route: '/settings' })

    expect(
      await screen.findByRole('heading', { name: 'My settings', level: 1 }),
    ).toBeInTheDocument()
  })

  it('renders every section of the page', async () => {
    mockAccount([])

    renderWithProviders(<AppRoutes />, { route: '/settings' })
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    for (const section of [
      'Profile',
      'Contact',
      'Notifications',
      'Appearance',
      'Account',
      'Danger zone',
    ]) {
      expect(
        await screen.findByRole('heading', { name: section, level: 2 }),
      ).toBeInTheDocument()
    }
  })

  it('shows the camper their own details', async () => {
    mockAccount([])

    renderWithProviders(<AppRoutes />, { route: '/settings' })
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    expect(screen.getByLabelText('Display name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.edu')
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('hides the Campsite settings link from campers without permission', async () => {
    mockAccount([])

    renderWithProviders(<AppRoutes />, { route: '/settings' })
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    expect(
      screen.queryByRole('link', { name: 'Campsite settings' }),
    ).not.toBeInTheDocument()
  })

  it('offers the Campsite settings link to someone who may view it', async () => {
    mockAccount(['settings.view'])

    renderWithProviders(<AppRoutes />, { route: '/settings' })
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    // The link appears in the sidebar and again under the section list;
    // scope to <main> so this is about the settings page's own nav.
    const page = within(screen.getByRole('main'))
    await waitFor(() =>
      expect(page.getByRole('link', { name: 'Campsite settings' })).toBeInTheDocument(),
    )
  })
})

describe('/settings/campsite', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    stubTables()
  })

  it('refuses a camper with neither permission', async () => {
    mockAccount([])

    renderWithProviders(<AppRoutes />, { route: '/settings/campsite' })

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access')
  })

  it('renders read-only for an adviser who may only view', async () => {
    mockAccount(['settings.view'])

    renderWithProviders(<AppRoutes />, { route: '/settings/campsite' })

    expect(
      await screen.findByRole('heading', { name: 'Campsite settings', level: 1 }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Read-only')

    // Every control is disabled, not merely styled as though it were.
    await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled())
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle).toBeDisabled()
    }
  })

  it('renders editable for someone holding settings.edit', async () => {
    mockAccount(['settings.view', 'settings.edit'])

    renderWithProviders(<AppRoutes />, { route: '/settings/campsite' })
    await screen.findByRole('heading', { name: 'Campsite settings', level: 1 })

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeEnabled())
    expect(screen.queryByText(/Read-only/)).not.toBeInTheDocument()
  })

  it('shows the identity, module, joining, and points sections', async () => {
    mockAccount(['settings.view', 'settings.edit'])

    renderWithProviders(<AppRoutes />, { route: '/settings/campsite' })
    await screen.findByRole('heading', { name: 'Campsite settings', level: 1 })

    for (const section of ['Identity', 'Modules', 'Joining', 'Points', 'Danger zone']) {
      expect(
        await screen.findByRole('heading', { name: section, level: 2 }),
      ).toBeInTheDocument()
    }
  })

  it('puts Break Camp behind a typed confirmation', async () => {
    mockAccount(['settings.view', 'settings.edit'])

    renderWithProviders(<AppRoutes />, { route: '/settings/campsite' })
    await screen.findByRole('heading', { name: 'Campsite settings', level: 1 })

    const danger = await screen.findByRole('region', { name: 'Danger zone' })
    expect(within(danger).getByRole('button', { name: 'Break Camp' })).toBeInTheDocument()
  })
})

describe('appearance applies when edited', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
    stubTables()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-reduce-motion')
  })

  /** Mounts the effect alongside the routes, as App does. */
  function renderApp() {
    return renderWithProviders(
      <>
        <AppearanceEffect />
        <AppRoutes />
      </>,
      { route: '/settings' },
    )
  }

  it('switches the document to dark when Dark is chosen', async () => {
    const user = userEvent.setup()
    mockAccount([])

    renderApp()
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    // The optimistic write updates the shared profile cache, which the
    // root-level effect reads — so the whole app changes, not just this page.
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark'),
    )
  })

  it('switches back to light when Light is chosen', async () => {
    const user = userEvent.setup()
    mockAccount([])

    renderApp()
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark'),
    )

    await user.click(screen.getByRole('radio', { name: 'Light' }))
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('light'),
    )
  })

  it('records the preference separately from the resolved theme', async () => {
    const user = userEvent.setup()
    mockAccount([])

    renderApp()
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    await user.click(screen.getByRole('radio', { name: 'System' }))

    // "System" resolves to light or dark for the stylesheet, but the choice
    // itself is kept so the OS watcher knows to keep following.
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme-preference')).toBe('system'),
    )
    expect(['light', 'dark']).toContain(
      document.documentElement.getAttribute('data-theme'),
    )
  })

  it('turns motion off across the app when Reduce motion is switched on', async () => {
    const user = userEvent.setup()
    mockAccount([])

    renderApp()
    await screen.findByRole('heading', { name: 'My settings', level: 1 })

    await user.click(screen.getByRole('switch', { name: 'Reduce motion' }))

    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('true'),
    )
  })
})
