import { Link } from 'react-router-dom'
import { Loader } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/ui/ErrorState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useCommittees } from './useCommittees'

export function CommitteesPage() {
  // Kept as one object so `shell` narrows `profile` to non-null below.
  const me = useCurrentUser()
  const committees = useCommittees()

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">L2 Campsite · 28 campers</p>
      <h1 className="text-display font-bold text-ink">Crews</h1>
    </header>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      <p className="mb-5 max-w-[70ch] text-sm text-ink-subtle">
        Twelve crews run the L2 Campsite. Everyone can see all of them; you can only
        be assigned tasks inside the crews you belong to.
      </p>

      {committees.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Rounding up your crews…
        </p>
      )}

      {committees.isError && (
        <ErrorState
          title="Could not load crews"
          description="The list did not come back. Try again in a moment."
          onRetry={() => void committees.refetch()}
        />
      )}

      {committees.isSuccess && (
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
          <div className="flex items-center gap-3.5 border-b border-border-divider bg-surface-sunken px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] text-ink-subtle uppercase">
            <span className="flex-1">Crew</span>
            <span className="hidden w-[170px] sm:block">Crew head</span>
            <span className="w-[110px] text-right">Campers</span>
          </div>

          <ul>
            {committees.data.map((committee) => (
              <li key={committee.id}>
                <Link
                  to={`/committees/${committee.id}`}
                  className="flex items-center gap-3.5 border-b border-border-divider px-5 py-3.5 text-sm text-ink transition duration-[260ms] ease-out-quick last:border-b-0 hover:translate-x-0.5 hover:bg-surface-muted"
                >
                  <span className="font-semibold">{committee.name}</span>
                  {committee.isMine && (
                    <StatusBadge tone="accent">You are in this crew</StatusBadge>
                  )}
                  {/* The trail fills the gap, tying the name to its figures. */}
                  <span aria-hidden="true" className="dotted-trail hidden h-px flex-1 sm:block" />
                  <span className="hidden w-[170px] text-[13.5px] text-ink-muted sm:block">
                    {committee.head ?? 'No crew head yet'}
                  </span>
                  <span className="ml-auto w-[110px] text-right font-mono text-[13px] text-ink-subtle sm:ml-0">
                    {committee.camperCount} campers
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  )
}
