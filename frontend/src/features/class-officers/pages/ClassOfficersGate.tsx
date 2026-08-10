import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import type { ClassOfficersDataProvider } from '../api/mockClassOfficersAdapter'
import { ClassOfficersProvider } from '../context/ClassOfficersProvider'
import { classOfficersPath, isClassCohort } from '../lib/paths'
import type { ClassCohort } from '../types'

/**
 * Auth gate + provider for Class Officers.
 * Cohort comes from the URL (`/class-officers/senior|junior/...`).
 * AC / ASBO see both cohorts as tabs; SCO / JCO stay locked to theirs.
 */
export function ClassOfficersGate({
  dataProvider,
}: {
  dataProvider: ClassOfficersDataProvider
}) {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const params = useParams()
  const cohortParam = params.cohort

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const canView = hasPermission(me, 'class_officers.view')
  const canSwitch = Boolean(me.can_switch_class_cohort) && canView
  const locked = me.class_cohort ?? null

  // Index / legacy redirects happen in sibling routes; when we have a cohort
  // segment, validate access.
  if (cohortParam !== undefined) {
    if (!isClassCohort(cohortParam)) {
      return <Navigate to={classOfficersPath(locked ?? 'senior')} replace />
    }
    if (!canSwitch && locked && cohortParam !== locked) {
      return <Navigate to={classOfficersPath(locked)} replace />
    }
    if (canView && !locked && !canSwitch) {
      return (
        <FullPageMessage>
          <ErrorState
            title="No class cohort assigned"
            description="Your account is not linked as SCO (senior) or JCO (junior). Ask AC to sync the roster."
          />
        </FullPageMessage>
      )
    }
  }

  const cohort: ClassCohort = isClassCohort(cohortParam)
    ? cohortParam
    : canSwitch
      ? 'senior'
      : (locked ?? 'senior')

  return (
    <ClassOfficersProvider
      dataProvider={dataProvider}
      cohort={cohort}
      canSwitchCohort={canSwitch}
    >
      <Outlet />
    </ClassOfficersProvider>
  )
}

/** `/class-officers` → senior (AC/ASBO) or the caller's locked cohort. */
export function ClassOfficersHomeRedirect() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return <Navigate to="/login" replace />
  }
  const me = meQuery.data
  const canSwitch = Boolean(me.can_switch_class_cohort)
  const target: ClassCohort = canSwitch ? 'senior' : (me.class_cohort ?? 'senior')
  return <Navigate to={classOfficersPath(target)} replace />
}

/** Old `/class-officers/fundraiser` paths → cohort-scoped URL. */
export function ClassOfficersLegacyRedirect({
  section,
}: {
  section: 'fundraiser' | 'homecoming'
}) {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return <Navigate to="/login" replace />
  }
  const me = meQuery.data
  const canSwitch = Boolean(me.can_switch_class_cohort)
  const target: ClassCohort = canSwitch ? 'senior' : (me.class_cohort ?? 'senior')
  return <Navigate to={classOfficersPath(target, section)} replace />
}
