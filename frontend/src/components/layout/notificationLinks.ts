import type { AppNotification } from '../../features/event-summary/api'

function eventRef(note: AppNotification): string | null {
  const { eventSlug, slug, eventId } = note.payload ?? {}
  for (const value of [eventSlug, slug, eventId]) {
    if (typeof value === 'string' && value) return value
  }
  return null
}

/**
 * Where opening a notification should take you.
 *
 * Shared by the bell and the Inbox so the two always agree. Null means the
 * notification is informational and has nowhere better to go.
 */
export function notificationHref(note: AppNotification): string | null {
  const ref = eventRef(note)

  if (note.type.startsWith('task.')) return '/tasks'
  if (note.type.startsWith('request.')) return '/requests'
  if (note.type === 'whereabouts.ping') return '/whereabouts'
  if (note.type === 'event.created') return '/events'
  if (note.type === 'wrapped.generated' || note.type === 'wrapped.published') {
    return ref ? `/events/${ref}/wrapped` : '/events'
  }
  return ref ? `/events/${ref}/summary` : null
}
