import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'

const TABS = [
  { to: '/class-officers', label: 'Overview', end: true },
  { to: '/class-officers/fundraiser', label: 'Fundraiser', end: false },
  { to: '/class-officers/homecoming', label: 'Homecoming', end: false },
] as const

export function ClassOfficersLayout() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  if (!hasPermission(me, 'class_officers.view')) {
    return (
      <AppShell
        name={me.full_name ?? me.email}
        role={me.role}
        permissions={me.permissions}
      >
        <ErrorState
          variant="unauthorized"
          title="Unauthorized"
          description="Class Officers is limited to class officers, class advisors, ASBO, and AC."
        />
      </AppShell>
    )
  }

  const canManage = hasPermission(me, 'class_officers.manage')

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Class Officers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fundraiser progress and Homecoming planning for SCO/JCO.
          {canManage
            ? ' You can edit these plans.'
            : ' View-only — ask a Class Officer to update figures.'}
        </p>
      </header>

      <nav
        aria-label="Class Officers sections"
        className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-accent-600 text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ canManage }} />
    </AppShell>
  )
}
