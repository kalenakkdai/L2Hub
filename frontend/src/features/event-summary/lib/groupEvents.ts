import type { EventListItem } from '../api'

/**
 * Buckets the Events page renders, in display order.
 *
 * `previous` is scoped to the current year, as the page asks for. Anything
 * older lands in `earlier` so that no event ever disappears from the page just
 * because a new year started.
 */
export type GroupedEvents = {
  current: EventListItem[]
  upcoming: EventListItem[]
  previous: EventListItem[]
  earlier: EventListItem[]
}

type Phase = 'current' | 'upcoming' | 'finished'

/** Parses an API timestamp, treating malformed values as absent. */
function timestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Decides which phase an event is in.
 *
 * Approved (`active`) events enter Happening now immediately. They stay there
 * through planning, the event date, and debrief work; they become finished
 * only after the scheduled date is over AND Wrapped has been generated.
 * `complete` uses the same closeout rule so manually ending the event does not
 * make it disappear while the class still owes its Wrapped.
 */
export function eventPhase(event: EventListItem, now: Date): Phase {
  const at = now.getTime()
  const startsAt = timestamp(event.startsAt)
  const endsAt = timestamp(event.endsAt)
  const wrappedGenerated = ['generated', 'published', 'archived'].includes(
    event.summaryStatus,
  )
  const datePassed =
    endsAt !== null
      ? at > endsAt
      : startsAt !== null
        ? at > startsAt
        : true

  if (event.eventStatus === 'active' || event.eventStatus === 'complete') {
    return datePassed && wrappedGenerated ? 'finished' : 'current'
  }

  if (startsAt !== null && at < startsAt) return 'upcoming'
  if (endsAt !== null && at > endsAt) return 'finished'
  // Started with no recorded end: treat it as underway rather than guessing.
  if (startsAt !== null) return 'current'
  if (endsAt !== null) return 'current'
  return 'upcoming'
}

/** Soonest first, with undated events after dated ones. */
function byStartAscending(a: EventListItem, b: EventListItem): number {
  const left = timestamp(a.startsAt)
  const right = timestamp(b.startsAt)
  if (left === null && right === null) return a.name.localeCompare(b.name)
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

/** Most recent first, so the newest debrief sits at the top of the block. */
function byRecencyDescending(a: EventListItem, b: EventListItem): number {
  const left = timestamp(a.endsAt) ?? timestamp(a.startsAt)
  const right = timestamp(b.endsAt) ?? timestamp(b.startsAt)
  if (left !== null && right !== null && left !== right) return right - left
  if (a.year !== b.year) return b.year - a.year
  return a.name.localeCompare(b.name)
}

export function groupEvents(events: EventListItem[], now: Date): GroupedEvents {
  const thisYear = now.getFullYear()
  const grouped: GroupedEvents = {
    current: [],
    upcoming: [],
    previous: [],
    earlier: [],
  }

  for (const event of events) {
    const phase = eventPhase(event, now)
    if (phase === 'current') {
      grouped.current.push(event)
    } else if (phase === 'upcoming') {
      grouped.upcoming.push(event)
    } else if (event.year === thisYear) {
      grouped.previous.push(event)
    } else {
      grouped.earlier.push(event)
    }
  }

  grouped.current.sort(byStartAscending)
  grouped.upcoming.sort(byStartAscending)
  grouped.previous.sort(byRecencyDescending)
  grouped.earlier.sort(byRecencyDescending)

  return grouped
}
