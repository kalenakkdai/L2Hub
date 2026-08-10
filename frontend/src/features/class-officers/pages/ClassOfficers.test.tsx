import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ClassOfficersLayout } from './ClassOfficersLayout'
import { ClassOfficersOverviewPage } from './ClassOfficersOverviewPage'
import { FundraiserPage } from './FundraiserPage'
import { HomecomingPage } from './HomecomingPage'
import { ClassOfficersProvider } from '../context/ClassOfficersProvider'
import { MockClassOfficersDataProvider } from '../api/mockClassOfficersAdapter'
import type { ClassCohort } from '../types'

const authState = vi.hoisted(() => ({
  permissions: [] as string[],
  class_cohort: 'senior' as ClassCohort | null,
  can_switch_class_cohort: false,
}))

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: async () => ({
    id: 'user-1',
    email: 'user@l2hub.local',
    full_name: 'Test User',
    role: 'class_advisor',
    permissions: authState.permissions,
    class_cohort: authState.class_cohort,
    can_switch_class_cohort: authState.can_switch_class_cohort,
  }),
  hasPermission: (user: { permissions?: string[] }, key: string) =>
    Boolean(user.permissions?.includes(key)),
}))

vi.mock('../../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function renderClassOfficers(
  route = '/class-officers/senior',
  cohort: ClassCohort = 'senior',
  canSwitch = false,
) {
  const dataProvider = new MockClassOfficersDataProvider()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    dataProvider,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ClassOfficersProvider
          dataProvider={dataProvider}
          cohort={cohort}
          canSwitchCohort={canSwitch}
        >
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/class-officers/:cohort" element={<ClassOfficersLayout />}>
                <Route index element={<ClassOfficersOverviewPage />} />
                <Route path="fundraiser" element={<FundraiserPage />} />
                <Route path="homecoming" element={<HomecomingPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ClassOfficersProvider>
      </QueryClientProvider>,
    ),
  }
}

afterEach(() => {
  authState.permissions = []
  authState.class_cohort = 'senior'
  authState.can_switch_class_cohort = false
})

describe('Class Officers permission gate', () => {
  it('blocks users without class_officers.view', async () => {
    authState.permissions = []
    renderClassOfficers()
    expect(await screen.findByText('Unauthorized')).toBeInTheDocument()
  })

  it('lets an authorized viewer see fundraiser and homecoming progress', async () => {
    authState.permissions = ['class_officers.view']
    renderClassOfficers()
    expect(
      await screen.findByRole('heading', {
        name: 'Senior Class Officers',
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/View-only/)).toBeInTheDocument()
    expect(await screen.findByText(/of \$8,000/)).toBeInTheDocument()
  })

  it('shows the junior workspace for JCO cohort', async () => {
    authState.permissions = ['class_officers.view']
    authState.class_cohort = 'junior'
    renderClassOfficers('/class-officers/junior', 'junior')
    expect(
      await screen.findByRole('heading', {
        name: 'Junior Class Officers',
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/of \$6,000/)).toBeInTheDocument()
  })

  it('shows Senior and Junior tabs for ASBO/AC', async () => {
    authState.permissions = ['class_officers.view', 'class_officers.manage']
    authState.class_cohort = null
    authState.can_switch_class_cohort = true
    renderClassOfficers('/class-officers/senior', 'senior', true)
    expect(await screen.findByRole('heading', { name: 'Class Officers', level: 1 })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Senior Class Officers' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Junior Class Officers' }),
    ).toBeInTheDocument()
  })
})

describe('Fundraiser edit gating', () => {
  it('hides the edit form from a view-only class advisor', async () => {
    authState.permissions = ['class_officers.view']
    renderClassOfficers('/class-officers/senior/fundraiser')
    expect(await screen.findByText(/Class Advisors can watch this bar/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Update goal' })).not.toBeInTheDocument()
  })

  it('lets a manager edit the raised amount and reflects it', async () => {
    authState.permissions = ['class_officers.view', 'class_officers.manage']
    const user = userEvent.setup()
    renderClassOfficers('/class-officers/senior/fundraiser')

    const raised = await screen.findByLabelText(/Raised/)
    await user.clear(raised)
    await user.type(raised, '5000')
    await user.click(screen.getByRole('button', { name: 'Save fundraiser' }))

    await waitFor(() => {
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument()
    })
  })
})

describe('Homecoming page', () => {
  it('renders the checkpoints calendar and crew lists', async () => {
    authState.permissions = ['class_officers.view']
    renderClassOfficers('/class-officers/senior/homecoming')

    const calendar = await screen.findByRole('region', { name: 'Checkpoints calendar' })
    expect(within(calendar).getByText('Theme locked')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stage crew' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cleanup crew' })).toBeInTheDocument()
    expect(screen.getByText(/Class Advisors can review these lists/)).toBeInTheDocument()
  })
})
