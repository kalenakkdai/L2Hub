import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import {
  approveSummary,
  fetchEvent,
  generateSummary,
  publishSummary,
  rejectSummary,
  requestSummary,
  summaryStatusLabel,
} from '../api'

export function EventSummaryPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const eventQuery = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => fetchEvent(eventId),
    enabled: Boolean(eventId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['events'] })
    void queryClient.invalidateQueries({ queryKey: ['events', eventId] })
  }

  const requestMutation = useMutation({
    mutationFn: () => requestSummary(eventId),
    onSuccess: invalidate,
  })
  const approveMutation = useMutation({
    mutationFn: () => approveSummary(eventId),
    onSuccess: () => {
      invalidate()
      void navigate(`/events/${eventId}/summary/generating`)
    },
  })
  const rejectMutation = useMutation({
    mutationFn: () => rejectSummary(eventId),
    onSuccess: invalidate,
  })
  const generateMutation = useMutation({
    mutationFn: () => generateSummary(eventId),
    onSuccess: () => {
      invalidate()
      void navigate(`/events/${eventId}/summary/generating`)
    },
  })
  const publishMutation = useMutation({
    mutationFn: () => publishSummary(eventId),
    onSuccess: invalidate,
  })

  if (meQuery.isPending || eventQuery.isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }
  if (eventQuery.isError || !eventQuery.data) {
    const unauthorized =
      eventQuery.error instanceof ApiError && eventQuery.error.status === 403
    return (
      <AppShell
        name={meQuery.data.full_name ?? meQuery.data.email}
        role={meQuery.data.role}
        permissions={meQuery.data.permissions}
      >
        <ErrorState
          title={unauthorized ? 'Unauthorized' : 'Event not found'}
          description={
            unauthorized
              ? 'You do not have access to this event summary.'
              : 'Check the event link and try again.'
          }
        />
      </AppShell>
    )
  }

  const me = meQuery.data
  const event = eventQuery.data
  const name = me.full_name ?? me.email
  const canRequest =
    Boolean(event.canRequest) || hasPermission(me, 'wrapped.request')
  const canApprove =
    Boolean(event.canApprove) || hasPermission(me, 'wrapped.approve')
  const canGenerate =
    Boolean(event.canGenerate) || hasPermission(me, 'wrapped.generate')
  const canPublish =
    Boolean(event.canPublish) || hasPermission(me, 'wrapped.publish')
  const busy =
    requestMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    generateMutation.isPending ||
    publishMutation.isPending

  return (
    <AppShell name={name} role={me.role} permissions={me.permissions}>
      <header className="mb-6 border-b border-border-subtle pb-4">
        <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          Event Summary
        </p>
        <h1 className="mt-1 text-display font-semibold text-ink">
          {event.name} {event.year}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Status:{' '}
          <span className="font-semibold text-ink">
            {summaryStatusLabel(event.summaryStatus)}
          </span>
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {event.summaryStatus === 'not_requested' && canRequest ? (
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-ink">Request generation</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Ask AC or President to approve Event Wrapped generation.
            </p>
            <Button
              className="mt-4"
              type="button"
              disabled={busy || event.eventStatus !== 'complete'}
              onClick={() => requestMutation.mutate()}
            >
              Generate Event Summary
            </Button>
          </section>
        ) : null}

        {event.summaryStatus === 'pending_approval' && canApprove ? (
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-ink">Approval required</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Approving starts generation. Rejecting returns the event to Not Requested.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => approveMutation.mutate()}
              >
                Approve &amp; Generate
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>
            </div>
          </section>
        ) : null}

        {event.summaryStatus === 'pending_approval' && !canApprove ? (
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-ink">Waiting for approval</h2>
            <p className="mt-1 text-sm text-ink-muted">
              AC or President must approve before generation starts.
            </p>
          </section>
        ) : null}

        {canGenerate &&
        (event.summaryStatus === 'not_requested' ||
          event.summaryStatus === 'generated') ? (
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-ink">
              {event.summaryStatus === 'generated' ? 'Regenerate' : 'Generate directly'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              AC and President can activate generation without a request.
            </p>
            <Button
              className="mt-4"
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => generateMutation.mutate()}
            >
              {event.summaryStatus === 'generated' ? 'Regenerate Wrapped' : 'Generate Now'}
            </Button>
          </section>
        ) : null}

        {event.summaryStatus === 'generating' ? (
          <ButtonLink to={`/events/${eventId}/summary/generating`}>
            View generation progress
          </ButtonLink>
        ) : null}

        {event.summaryStatus === 'generated' || event.summaryStatus === 'published' ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/events/${eventId}/wrapped`}>Open Wrapped</ButtonLink>
            <ButtonLink to={`/events/${eventId}/agenda`} variant="secondary">
              Agenda
            </ButtonLink>
            <ButtonLink to={`/events/${eventId}/live`} variant="secondary">
              Live bubbles
            </ButtonLink>
            {canPublish && event.summaryStatus === 'generated' ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => publishMutation.mutate()}
              >
                Publish to members
              </Button>
            ) : null}
          </div>
        ) : null}

        <ButtonLink to="/events" variant="ghost">
          Back to events
        </ButtonLink>
      </div>
    </AppShell>
  )
}
