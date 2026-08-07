const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

/** "in 2 days" / "3 hours ago", from an ISO timestamp. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  let duration = (new Date(iso).getTime() - now.getTime()) / 1000

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  return RELATIVE.format(Math.round(duration), 'year')
}

/** "Tue, 12 Mar · 4:30 PM" */
export function eventDateTime(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${day} · ${timeOfDay(iso)}`
}

/** "4:30 PM" */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "AUG 07" — the mono date stamp used in rails and lists. */
export function dateStamp(iso: string): string {
  return new Date(iso)
    .toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
    .toUpperCase()
}

/** "Thursday, August 7 · 4:30 PM" — the line above the greeting. */
export function longDateTime(now: Date = new Date()): string {
  const day = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

/**
 * "18h 42m" until an event starts.
 *
 * Returns null once the event has begun — a negative countdown is worse than
 * no countdown, and the caller can say something more useful instead.
 */
export function countdown(iso: string, now: Date = new Date()): string | null {
  const ms = new Date(iso).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null

  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** "Today" / "Tomorrow" / "Fri Aug 7" for the day an event falls on. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const target = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round(
    (startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000,
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  return target.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Weekday abbreviation for the calendar rail — "THU". */
export function weekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
}

/** Day of month, zero-padded — "06". */
export function dayOfMonth(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, '0')
}
