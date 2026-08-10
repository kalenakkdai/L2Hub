import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useClassOfficersContext } from '../context/ClassOfficersProvider'
import { classOfficersPath } from '../lib/paths'

export function ClassOfficersLayout() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const { cohort, canSwitchCohort } = useClassOfficersContext()

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
  const title =
    cohort === 'senior' ? 'Senior Class Officers' : 'Junior Class Officers'

  const sectionTabs = [
    { to: classOfficersPath(cohort), label: 'Overview', end: true },
    { to: classOfficersPath(cohort, 'fundraiser'), label: 'Fundraiser', end: false },
    { to: classOfficersPath(cohort, 'homecoming'), label: 'Homecoming', end: false },
  ] as const

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">
          {canSwitchCohort ? 'Class Officers' : title}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {canSwitchCohort
            ? 'Senior and Junior workspaces are separate — switch tabs to open each class.'
            : 'Fundraiser progress and Homecoming planning for this class only.'}
          {canManage
            ? ' You can edit these plans.'
            : ' View-only — ask a Class Officer to update figures.'}
        </p>
      </header>

      {canSwitchCohort ? (
        <nav
          aria-label="Class cohort"
          className="mb-4 flex flex-wrap gap-1 border-b border-border-subtle"
        >
          {(
            [
              { cohort: 'senior' as const, label: 'Senior Class Officers' },
              { cohort: 'junior' as const, label: 'Junior Class Officers' },
            ] as const
          ).map((tab) => (
            <NavLink
              key={tab.cohort}
              to={classOfficersPath(tab.cohort)}
              className={({ isActive }) =>
                [
                  'border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                  isActive || cohort === tab.cohort
                    ? 'border-accent-600 text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      ) : null}

      {!canSwitchCohort ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <h2 className="mb-3 text-title font-semibold text-ink">{title}</h2>
      )}

      <nav
        aria-label="Class Officers sections"
        className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {sectionTabs.map((tab) => (
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

      <Outlet context={{ canManage, cohort }} />
    </AppShell>
  )
}
