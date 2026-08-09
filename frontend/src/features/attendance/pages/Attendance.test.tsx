import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttendancePage } from './AttendancePage'
import { WhereaboutsMapPage } from './WhereaboutsMapPage'

const authState = vi.hoisted(() => ({
  permissions: ['attendance.manage_all', 'attendance.view_all'] as string[],
}))

const createDay = vi.hoisted(() => ({
  mutateAsync: vi.fn(async () => ({ id: 'day-1' })),
  isPending: false,
}))

const ping = vi.hoisted(() => ({
  mutateAsync: vi.fn(async () => ({
    id: 'ping-1',
    deliveryStatus: 'delivered_in_app',
    smsPhone: null,
    smsUrl: null,
  })),
  isPending: false,
}))

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: async () => ({
    id: 'operator-1',
    email: 'asbo@example.edu',
    full_name: 'ASBO Operator',
    role: 'asbo',
    permissions: authState.permissions,
  }),
  hasPermission: (user: { permissions?: string[] }, permission: string) =>
    Boolean(user.permissions?.includes(permission)),
}))

vi.mock('../../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../hooks', () => ({
  useAttendanceDay: () => ({
    isPending: false,
    isError: false,
    data: {
      id: 'day-1',
      schoolDate: '2026-08-08',
      startsAt: '2026-08-08T15:00:00Z',
      endsAt: '2026-08-08T15:50:00Z',
      status: 'closed',
      closedAt: '2026-08-08T15:50:00Z',
      recordCount: 1,
      records: [
        {
          id: 'record-1',
          profileId: 'student-1',
          displayName: 'Red Student',
          checkedInAt: '2026-08-08T15:20:00Z',
          checkInSource: 'barcode',
          late: true,
          scorePercent: 90,
          presentPercent: 60,
          status: 'under_80',
          manualNote: null,
          editedAt: null,
          parentAlertSentAt: null,
          needsAttention: true,
        },
      ],
    },
    refetch: vi.fn(),
  }),
  useAttendanceStudents: () => ({ data: [], isPending: false }),
  useWhereabouts: () => ({
    data: [
      {
        id: 'where-1',
        profileId: 'student-1',
        displayName: 'Alex Rivera',
        kind: 'errand',
        destinationKey: 'office',
        customDestination: null,
        taskName: 'Pick up forms',
        leftAt: '2026-08-08T15:20:00Z',
        returnedAt: null,
        canSms: false,
      },
    ],
    isError: false,
    refetch: vi.fn(),
  }),
  useAttendanceCommands: () => ({
    createDay,
    scan: { mutateAsync: vi.fn(), isPending: false },
    closeDay: { mutateAsync: vi.fn(), isPending: false },
    editRecord: { mutate: vi.fn(), isPending: false },
    saveIdentity: { mutate: vi.fn(), isPending: false },
    checkout: { mutate: vi.fn(), isPending: false },
    returnEntry: { mutate: vi.fn(), isPending: false },
    ping,
  }),
}))

function renderPage(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  authState.permissions = ['attendance.manage_all', 'attendance.view_all']
  vi.clearAllMocks()
})

describe('AttendancePage', () => {
  it('blocks a regular member from the scanner and manual records', async () => {
    authState.permissions = []
    renderPage(<AttendancePage />)
    expect(
      await screen.findByText('Attendance console restricted'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Scan student ID')).not.toBeInTheDocument()
  })

  it('opens the server-dated daily log and shows the under-80 warning', async () => {
    renderPage(<AttendancePage />)
    expect(await screen.findByRole('heading', { name: 'Attendance' })).toBeInTheDocument()
    expect(createDay.mutateAsync).toHaveBeenCalledWith({})
    expect(await screen.findByText('Red Student')).toBeInTheDocument()
    expect(screen.getByText(/present 60%/)).toBeInTheDocument()
  })

  it('includes camera scanning, typed ID, and passkey check-in choices', async () => {
    renderPage(<AttendancePage />)
    expect(await screen.findByText('Scan student ID')).toBeInTheDocument()
    expect(screen.getByText('Type student ID')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Check in with personal-device passkey',
      }),
    ).toBeInTheDocument()
  })
})

describe('WhereaboutsMapPage', () => {
  it('shows declared destination, initials, full name, and task', async () => {
    renderPage(<WhereaboutsMapPage />)
    expect(
      await screen.findByRole('heading', { name: /MSJHS whereabouts map/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Alex Rivera at Main office' }),
    ).toHaveTextContent('AR')
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getByText('Pick up forms')).toBeInTheDocument()
  })
})
