import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '../auth/useCurrentUser'
import { AppShell } from '../components/layout/AppShell'
import { EmptyState } from '../components/ui/EmptyState'

/** Any address the route table does not know, inside the normal chrome. */
export function NotFoundPage() {
  const me = useCurrentUser()

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
    >
      <EmptyState
        icon={Compass}
        title="This page does not exist"
        description="The link may be old, or the page may have moved. Everything that exists is in the menu."
        action={
          <Link
            to="/dashboard"
            className="text-sm font-medium text-accent-600 underline-offset-2 hover:underline"
          >
            Back to the dashboard
          </Link>
        }
      />
    </AppShell>
  )
}
