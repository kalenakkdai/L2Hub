import type { EventListItem } from '../../event-summary/api'
import type { GroupedEvents } from '../../event-summary/lib/groupEvents'

export type CampfireTone = 'now' | 'next' | 'recent'

export type CampfireSelection = {
  tone: CampfireTone
  events: EventListItem[]
}

const MAX_FALLBACK = 5

/**
 * Which events get a campfire on the Event planning page.
 *
 * Running events come first, because that is where a meeting is most likely to
 * be recorded. Between events there would be nothing to sit at, so the section
 * falls back to what is scheduled next and then to what just finished — a
 * post-event debrief still needs somewhere to file its notes.
 */
export function selectCampfireEvents(grouped: GroupedEvents): CampfireSelection {
  if (grouped.current.length > 0) {
    return { tone: 'now', events: grouped.current }
  }
  if (grouped.upcoming.length > 0) {
    return { tone: 'next', events: grouped.upcoming.slice(0, MAX_FALLBACK) }
  }
  return {
    tone: 'recent',
    events: [...grouped.previous, ...grouped.earlier].slice(0, MAX_FALLBACK),
  }
}

export function campfireHeading(tone: CampfireTone): string {
  if (tone === 'now') return 'Happening now'
  if (tone === 'next') return 'Next up'
  return 'Recent events'
}
