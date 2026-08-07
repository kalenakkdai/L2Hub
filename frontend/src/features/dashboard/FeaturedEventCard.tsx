import { CalendarDays, MapPin, MessagesSquare } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { eventDateTime, relativeTime } from './formatDate'
import type { FeaturedItem } from './types'

/**
 * The one saturated element on the screen: a navy surface carrying whatever
 * needs attention next. Exactly one of these renders at a time.
 */
export function FeaturedEventCard({ item }: { item: FeaturedItem }) {
  const Icon = item.kind === 'debrief' ? MessagesSquare : CalendarDays

  return (
    <article className="on-navy relative overflow-hidden rounded-card bg-navy-900 p-6 shadow-card sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-label font-medium tracking-wide text-navy-ink-muted uppercase">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {item.kind === 'debrief' ? 'Active debrief' : 'Next event'}
        </span>
        <StatusBadge tone={item.status.tone}>{item.status.label}</StatusBadge>
      </div>

      <h2 className="mt-3 text-title font-semibold text-navy-ink sm:text-2xl">
        {item.title}
      </h2>

      <p className="mt-2 max-w-2xl text-sm text-navy-ink-muted">{item.summary}</p>

      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-ink-muted">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Starts</dt>
          <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
          <dd>
            <time dateTime={item.startsAt}>{eventDateTime(item.startsAt)}</time>
            <span className="text-navy-ink-muted/70"> ({relativeTime(item.startsAt)})</span>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Location</dt>
          <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
          <dd>{item.location}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <ButtonLink to={item.to}>{item.actionLabel}</ButtonLink>
      </div>
    </article>
  )
}
