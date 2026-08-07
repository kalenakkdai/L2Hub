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
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day} · ${time}`
}
