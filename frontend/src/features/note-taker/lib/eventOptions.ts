import type { EventListItem } from '../../event-summary/api'
import { groupEvents } from '../../event-summary/lib/groupEvents'

export type EventOption = {
  id: string
  label: string
}

/**
 * Deep link to an event's campfire timeline.
 *
 * The constellation lives on the Event planning board rather than its own route,
 * so the campfire to expand travels as a query param.
 */
export function eventTimelinePath(eventId: string): string {
  return `/event-planning?campfire=${encodeURIComponent(eventId)}`
}

export type EventOptionGroup = {
  label: string
  options: EventOption[]
}

/** Matches the campfire rows, so the same event reads the same in both places. */
export function eventOptionLabel(event: EventListItem): string {
  return `${event.name} ${event.year}`
}

/**
 * Events a meeting can be filed under, grouped for a `<select>`.
 *
 * Running events come first because they are what someone is most likely to be
 * meeting about, and empty groups are dropped so the menu has no dead headings.
 */
export function eventOptionGroups(
  events: EventListItem[],
  now: Date,
): EventOptionGroup[] {
  const grouped = groupEvents(events, now)
  const candidates: EventOptionGroup[] = [
    { label: 'Happening now', options: grouped.current.map(toOption) },
    { label: 'Upcoming', options: grouped.upcoming.map(toOption) },
    { label: 'Earlier this year', options: grouped.previous.map(toOption) },
    { label: 'Previous years', options: grouped.earlier.map(toOption) },
  ]
  return candidates.filter((group) => group.options.length > 0)
}

function toOption(event: EventListItem): EventOption {
  return { id: event.id, label: eventOptionLabel(event) }
}

/**
 * Looks up the label for the filing target.
 *
 * A preselected id from the campfire link may not appear in the list the viewer
 * can load, so callers pass the name carried in the URL as a fallback rather
 * than showing a bare UUID.
 */
export function findEventLabel(
  groups: EventOptionGroup[],
  eventId: string | null,
  fallbackName?: string | null,
): string | null {
  if (!eventId) return null
  for (const group of groups) {
    const match = group.options.find((option) => option.id === eventId)
    if (match) return match.label
  }
  return fallbackName?.trim() ? fallbackName.trim() : null
}
