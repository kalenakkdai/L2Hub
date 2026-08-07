import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { fetchLiveParticipants, type LiveParticipant } from '../api'

function bubbleTone(status: LiveParticipant['status']) {
  switch (status) {
    case 'submitted':
      return 'bg-emerald-500'
    case 'writing':
      return 'bg-amber-400'
    case 'absent':
      return 'bg-zinc-400'
    default:
      return 'bg-rose-500'
  }
}

function statusLabel(status: LiveParticipant['status']) {
  switch (status) {
    case 'submitted':
      return 'Submitted'
    case 'writing':
      return 'Writing'
    case 'absent':
      return 'Absent'
    default:
      return 'Not started'
  }
}

export function LiveBubblesPage() {
  const { eventId = '' } = useParams()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const liveQuery = useQuery({
    queryKey: ['events', eventId, 'live'],
    queryFn: () => fetchLiveParticipants(eventId),
    enabled: Boolean(eventId),
    refetchInterval: 4000,
  })

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const unauthorized =
    liveQuery.error instanceof ApiError && liveQuery.error.status === 403

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Live debrief bubbles</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Participant status for the active or completed debrief session.
        </p>
      </header>

      {unauthorized ? (
        <ErrorState
          title="Unauthorized"
          description="Live monitor access is limited to ASBO+, AC, and President."
        />
      ) : null}

      {liveQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading participants…</p>
      ) : null}

      {liveQuery.data ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Submitted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Writing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Not started
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Absent
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {liveQuery.data.participants.map((p) => (
              <div
                key={p.id}
                className="flex w-28 flex-col items-center gap-2 text-center"
                title={statusLabel(p.status)}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ${bubbleTone(p.status)}`}
                >
                  {p.displayName
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="text-xs font-medium text-ink">{p.displayName}</span>
                <span className="text-[11px] text-ink-subtle">
                  {statusLabel(p.status)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-8">
        <ButtonLink to={`/events/${eventId}/summary`} variant="ghost">
          Back to summary
        </ButtonLink>
      </div>
    </AppShell>
  )
}
