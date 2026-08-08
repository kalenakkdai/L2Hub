import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { CampsiteScene } from '../components/CampsiteScene'
import {
  fetchEvents,
  requestSummary,
  summaryStatusLabel,
  type SummaryStatus,
} from '../api'

function StatusBadge({ status }: { status: SummaryStatus | string }) {
  const tone =
    status === 'published'
      ? 'bg-accent-50 text-accent-700'
      : status === 'generating' || status === 'pending_approval'
        ? 'bg-status-warning-bg text-status-warning'
        : status === 'generated'
          ? 'bg-status-info-bg text-status-info'
          : 'bg-status-neutral-bg text-ink-muted'
  return (
    <span className={`rounded-control px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {summaryStatusLabel(status)}
    </span>
  )
}

export function EventsPage() {
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents })

  const requestMutation = useMutation({
    mutationFn: (eventRef: string) => requestSummary(eventRef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
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
  const name = me.full_name ?? me.email
  const canRequest = hasPermission(me, 'wrapped.request')

  return (
    <AppShell name={name} role={me.role} permissions={me.permissions}>
      <CampsiteScene />

      <div className="on-navy relative z-10 pb-16">
        <header className="mb-5 border-b border-white/12 pt-2 pb-4 sm:pt-6">
          <h1 className="text-display font-semibold text-navy-ink">Events</h1>
          <p className="mt-1 text-sm text-navy-ink-muted">
            Track Event Summary status and open Wrapped experiences.
          </p>
        </header>

        {eventsQuery.isPending ? (
          <p className="text-sm text-navy-ink-muted">Loading events…</p>
        ) : null}
        {eventsQuery.isError ? (
          <ErrorState
            title="Could not load events"
            description="Check that the backend is running."
            onRetry={() => void eventsQuery.refetch()}
          />
        ) : null}

        {eventsQuery.data ? (
          <div className="overflow-hidden rounded-card border border-white/12 bg-white/[0.07] shadow-card backdrop-blur-sm">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="border-b border-white/15 bg-white/[0.06]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-ink-muted">
                    Event
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold text-navy-ink-muted">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-navy-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventsQuery.data.events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-navy-ink">
                        {event.name} {event.year}
                      </p>
                      <p className="text-xs text-navy-ink-muted capitalize">
                        {event.eventStatus}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={event.summaryStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ButtonLink
                          to={`/events/${event.slug}/summary`}
                          variant="navy"
                          size="sm"
                        >
                          Open
                        </ButtonLink>
                        {event.summaryStatus === 'published' ||
                        event.summaryStatus === 'generated' ? (
                          <ButtonLink to={`/events/${event.slug}/wrapped`} size="sm">
                            Wrapped
                          </ButtonLink>
                        ) : null}
                        {canRequest &&
                        event.eventStatus === 'complete' &&
                        event.summaryStatus === 'not_requested' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="navy"
                            disabled={requestMutation.isPending}
                            onClick={() => requestMutation.mutate(event.slug)}
                          >
                            Generate Event Summary
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
