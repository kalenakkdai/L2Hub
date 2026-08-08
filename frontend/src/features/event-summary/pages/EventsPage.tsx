import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { CampsiteScene } from '../components/CampsiteScene'
import { EventRecapPanel } from '../components/EventRecapPanel'
import { groupEvents } from '../lib/groupEvents'
import {
  fetchEvents,
  requestSummary,
  summaryStatusLabel,
  type EventListItem,
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

/** Renders the scheduled window when the event has one. */
function whenLabel(event: EventListItem): string | null {
  if (!event.startsAt) return null
  const starts = new Date(event.startsAt)
  if (Number.isNaN(starts.getTime())) return null
  return starts.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type RowProps = {
  event: EventListItem
  open: boolean
  onToggle: () => void
  canRequest: boolean
  requestPending: boolean
  onRequest: (slug: string) => void
}

function EventRows({
  event,
  open,
  onToggle,
  canRequest,
  requestPending,
  onRequest,
}: RowProps) {
  // The recap unlocks only once the class has been through the full Wrapped
  // together.
  const reviewed = Boolean(event.wrappedPresentedAt)
  const panelId = `event-recap-${event.id}`
  const when = whenLabel(event)

  return (
    <>
      <tr className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.04]">
        <td className="px-1 py-3 align-top">
          {reviewed ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-control text-navy-ink-muted hover:bg-white/10 hover:text-navy-ink"
            >
              <span className="sr-only">
                {open ? 'Hide' : 'Show'} {event.name} {event.year} recap
              </span>
              <ChevronRight
                aria-hidden="true"
                size={16}
                className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              />
            </button>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-navy-ink">
            {event.name} {event.year}
          </p>
          <p className="text-xs text-navy-ink-muted capitalize">
            {when ? `${when} · ${event.eventStatus}` : event.eventStatus}
          </p>
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={event.summaryStatus} />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <ButtonLink to={`/events/${event.slug}/summary`} variant="navy" size="sm">
              Open
            </ButtonLink>
            {event.summaryStatus === 'published' || event.summaryStatus === 'generated' ? (
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
                disabled={requestPending}
                onClick={() => onRequest(event.slug)}
              >
                Generate Event Summary
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-white/10">
          <td colSpan={4} className="p-0">
            <div id={panelId} className="bg-white/[0.04]">
              <EventRecapPanel eventRef={event.slug} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

type TableProps = Omit<RowProps, 'event' | 'open' | 'onToggle'> & {
  events: EventListItem[]
  expanded: string | null
  onExpand: (id: string | null) => void
}

function EventTable({ events, expanded, onExpand, ...rowProps }: TableProps) {
  return (
    <table className="w-full min-w-[640px] border-collapse text-left">
      <thead className="border-b border-white/15 bg-white/[0.06]">
        <tr>
          <th className="w-10 px-1 py-2">
            <span className="sr-only">Expand recap</span>
          </th>
          <th className="px-4 py-2 text-xs font-semibold text-navy-ink-muted">Event</th>
          <th className="px-3 py-2 text-xs font-semibold text-navy-ink-muted">Summary</th>
          <th className="px-4 py-2 text-right text-xs font-semibold text-navy-ink-muted">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          const open = Boolean(event.wrappedPresentedAt) && expanded === event.id
          return (
            <EventRows
              key={event.id}
              event={event}
              open={open}
              onToggle={() => onExpand(open ? null : event.id)}
              {...rowProps}
            />
          )
        })}
      </tbody>
    </table>
  )
}

function EventBlock({
  title,
  description,
  emptyText,
  events,
  highlight = false,
  children,
  ...tableProps
}: Omit<TableProps, 'events'> & {
  title: string
  description: string
  emptyText: string
  events: EventListItem[]
  highlight?: boolean
  children?: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-card border shadow-card backdrop-blur-sm ${
        highlight
          ? 'border-accent-400/50 bg-white/[0.10]'
          : 'border-white/12 bg-white/[0.07]'
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/12 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-ink">{title}</h2>
          <p className="text-xs text-navy-ink-muted">{description}</p>
        </div>
        <span className="rounded-control bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-navy-ink-muted">
          {events.length}
        </span>
      </header>

      {events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-navy-ink-muted">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <EventTable events={events} {...tableProps} />
        </div>
      )}

      {children}
    </section>
  )
}

export function EventsPage() {
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)

  // Grouping is cosmetic, so the browser clock is fine here. Anything the
  // gradebook depends on stays server-authoritative.
  const now = useMemo(() => new Date(), [])
  const grouped = useMemo(
    () => groupEvents(eventsQuery.data?.events ?? [], now),
    [eventsQuery.data, now],
  )

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

  const shared = {
    expanded,
    onExpand: setExpanded,
    canRequest,
    requestPending: requestMutation.isPending,
    onRequest: (slug: string) => requestMutation.mutate(slug),
  }

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
          <div className="space-y-5">
            <EventBlock
              title="Happening now"
              description="Events inside their scheduled window."
              emptyText="Nothing is running right now."
              events={grouped.current}
              highlight={grouped.current.length > 0}
              {...shared}
            />

            <EventBlock
              title="Upcoming"
              description="Scheduled events that have not started."
              emptyText="No upcoming events scheduled."
              events={grouped.upcoming}
              {...shared}
            />

            <EventBlock
              title={`Previous (${now.getFullYear()})`}
              description="Events that have already wrapped up this year."
              emptyText="No events have finished yet this year."
              events={grouped.previous}
              {...shared}
            >
              {grouped.earlier.length > 0 ? (
                <div className="border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={showEarlier}
                    onClick={() => setShowEarlier((value) => !value)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-navy-ink-muted hover:text-navy-ink"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      size={14}
                      className={`transition-transform duration-200 ${
                        showEarlier ? 'rotate-90' : ''
                      }`}
                    />
                    Earlier years ({grouped.earlier.length})
                  </button>
                  {showEarlier ? (
                    <div className="mt-3 overflow-x-auto">
                      <EventTable events={grouped.earlier} {...shared} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </EventBlock>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
