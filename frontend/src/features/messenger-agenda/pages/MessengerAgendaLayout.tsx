import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'

export function MessengerAgendaLayout() {
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
  if (!hasPermission(me, 'messenger_agenda.view')) {
    return (
      <AppShell name={me.full_name ?? me.email} role={me.role} permissions={me.permissions}>
        <ErrorState
          variant="unauthorized"
          title="Unauthorized"
          description="Messenger Agenda is available to Leadership members."
        />
      </AppShell>
    )
  }

  return (
    <AppShell name={me.full_name ?? me.email} role={me.role} permissions={me.permissions}>
      <Outlet
        context={{
          canIngest: hasPermission(me, 'messenger_agenda.ingest'),
          canPlan: hasPermission(me, 'planning.create'),
        }}
      />
    </AppShell>
  )
}
