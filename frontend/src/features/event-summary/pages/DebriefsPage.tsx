import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { fetchEvents, fetchLiveParticipants, type LiveParticipant } from '../api'

const OPEN_STATUSES: Array<LiveParticipant['status']> = ['not_started', 'writing']

function tally(participants: LiveParticipant[]) {
  return participants.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})
}

/**
 * Index of every event's debrief. A debrief counts as open while anyone is
 * still writing or has not started, which is what the live monitor shows.
 */
export function DebriefsPage() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents })
  const events = eventsQuery.data?.events ?? []

  const liveQueries = useQueries({
    queries: events.map((event) => ({
      queryKey: ['events', event.slug, 'live'],
      queryFn: () => fetchLiveParticipants(event.slug),
      refetchInterval: 5000,
      retry: false,
    })),
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

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Debriefs</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Participation for each event debrief. Open the monitor to watch bubbles
          update live.
        </p>
      </header>

      {eventsQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading debriefs…</p>
      ) : null}
      {eventsQuery.isError ? (
        <ErrorState
          title="Could not load debriefs"
          description="Check that the backend is running."
          onRetry={() => void eventsQuery.refetch()}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        {events.map((event, index) => {
          const live = liveQueries[index]
          const participants = live?.data?.participants ?? []
          const counts = tally(participants)
          const openCount = OPEN_STATUSES.reduce(
            (sum, status) => sum + (counts[status] ?? 0),
            0,
          )
          const forbidden =
            live?.error instanceof ApiError && live.error.status === 403

          return (
            <section
              key={event.id}
              className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    {event.name} {event.year}
                  </h2>
                  {forbidden ? (
                    <p className="mt-1 text-xs text-ink-subtle">
                      You do not have access to this debrief monitor.
                    </p>
                  ) : participants.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-subtle">
                      No debrief participants recorded.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-muted">
                      {participants.length} participants ·{' '}
                      {counts.submitted ?? 0} submitted · {counts.writing ?? 0}{' '}
                      writing · {counts.not_started ?? 0} not started ·{' '}
                      {counts.absent ?? 0} absent
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {participants.length > 0 ? (
                    <span
                      className={`rounded-control px-2 py-0.5 text-[11px] font-semibold ${
                        openCount > 0
                          ? 'bg-status-warning-bg text-status-warning'
                          : 'bg-accent-50 text-accent-ink'
                      }`}
                    >
                      {openCount > 0 ? `Open · ${openCount} outstanding` : 'All submitted'}
                    </span>
                  ) : null}
                  {!forbidden ? (
                    <ButtonLink
                      to={`/events/${event.slug}/live`}
                      variant="secondary"
                      size="sm"
                    >
                      Live monitor
                    </ButtonLink>
                  ) : null}
                </div>
              </div>

              {participants.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {participants.map((p) => (
                    <span
                      key={p.id}
                      title={`${p.displayName} — ${p.status}`}
                      className={`h-3 w-3 rounded-full ${
                        p.status === 'submitted'
                          ? 'bg-emerald-500'
                          : p.status === 'writing'
                            ? 'bg-amber-400'
                            : p.status === 'absent'
                              ? 'bg-zinc-400'
                              : 'bg-rose-500'
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}
