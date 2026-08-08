import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { CampsiteScene } from '../components/CampsiteScene'
import { SummaryTrail } from '../components/SummaryTrail'
import {
  approveSummary,
  fetchEvent,
  generateSummary,
  publishSummary,
  rejectSummary,
  requestSummary,
  summaryStatusLabel,
} from '../api'

const PANEL =
  'rounded-card border border-white/12 bg-white/[0.07] p-5 shadow-card backdrop-blur-sm'

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
      <CampsiteScene />

      <div className="on-navy relative z-10">
        <header className="mb-6 pt-2 sm:pt-6">
          <p className="text-xs font-semibold tracking-wide text-navy-ink-muted uppercase">
            Event Summary
          </p>
          <h1 className="mt-1 text-display font-semibold text-navy-ink">
            {event.name} {event.year}
          </h1>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-navy-ink-muted">
            Status:{' '}
            <span className="font-semibold text-navy-ink">
              {summaryStatusLabel(event.summaryStatus)}
            </span>
          </p>

          <SummaryTrail status={event.summaryStatus} />

          {event.summaryStatus === 'generated' || event.summaryStatus === 'published' ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink to={`/events/${eventId}/wrapped`}>Open Wrapped</ButtonLink>
              <ButtonLink to={`/events/${eventId}/agenda`} variant="navy">
                Agenda
              </ButtonLink>
              <ButtonLink to={`/events/${eventId}/live`} variant="navy">
                Live bubbles
              </ButtonLink>
            </div>
          ) : null}
        </header>

        <div className="flex flex-col gap-4 pb-16">
          {event.summaryStatus === 'not_requested' && canRequest ? (
            <section className={PANEL}>
              <h2 className="text-sm font-semibold text-navy-ink">
                Request generation
              </h2>
              <p className="mt-1 text-sm text-navy-ink-muted">
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
            <section className={PANEL}>
              <h2 className="text-sm font-semibold text-navy-ink">
                Approval required
              </h2>
              <p className="mt-1 text-sm text-navy-ink-muted">
                Approving starts generation. Rejecting returns the event to Not
                Requested.
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
                  variant="navy"
                  disabled={busy}
                  onClick={() => rejectMutation.mutate()}
                >
                  Reject
                </Button>
              </div>
            </section>
          ) : null}

          {event.summaryStatus === 'pending_approval' && !canApprove ? (
            <section className={PANEL}>
              <h2 className="text-sm font-semibold text-navy-ink">
                Waiting for approval
              </h2>
              <p className="mt-1 text-sm text-navy-ink-muted">
                AC or President must approve before generation starts.
              </p>
            </section>
          ) : null}

          {canGenerate &&
          (event.summaryStatus === 'not_requested' ||
            event.summaryStatus === 'generated' ||
            event.summaryStatus === 'published') ? (
            <section className={PANEL}>
              <h2 className="text-sm font-semibold text-navy-ink">
                {event.summaryStatus === 'not_requested'
                  ? 'Generate directly'
                  : 'Regenerate'}
              </h2>
              <p className="mt-1 text-sm text-navy-ink-muted">
                {event.summaryStatus === 'published'
                  ? 'Regenerating replaces this Wrapped and returns it to unpublished until you publish again.'
                  : 'AC and President can activate generation without a request.'}
              </p>
              <Button
                className="mt-4"
                type="button"
                variant="navy"
                disabled={busy}
                onClick={() => generateMutation.mutate()}
              >
                {event.summaryStatus === 'not_requested'
                  ? 'Generate Now'
                  : 'Regenerate Wrapped'}
              </Button>
            </section>
          ) : null}

          {event.summaryStatus === 'generating' ? (
            <ButtonLink to={`/events/${eventId}/summary/generating`}>
              View generation progress
            </ButtonLink>
          ) : null}

          {canPublish && event.summaryStatus === 'generated' ? (
            <section className={PANEL}>
              <h2 className="text-sm font-semibold text-navy-ink">Publish</h2>
              <p className="mt-1 text-sm text-navy-ink-muted">
                Publishing makes this Wrapped visible to every member who can see
                the event.
              </p>
              <Button
                className="mt-4"
                type="button"
                disabled={busy}
                onClick={() => publishMutation.mutate()}
              >
                Publish to members
              </Button>
            </section>
          ) : null}

          <div>
            <ButtonLink to="/events" variant="navy">
              Back to events
            </ButtonLink>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
