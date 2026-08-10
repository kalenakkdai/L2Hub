import { AlertTriangle, Send } from 'lucide-react'
import { cn } from '../../components/ui/cn'
import { initials } from '../../lib/initials'
import type { BoardTask } from './api'
import { dueLabel } from './dueDates'

/**
 * A person's initials in a small well.
 *
 * Hidden from assistive tech: the name is always rendered next to it, and a
 * screen reader announcing "AR, Alex Rivera" is worse than either alone.
 */
export function PersonChip({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-[10.5px] font-semibold text-accent-600"
    >
      {name ? initials(name) : '—'}
    </span>
  )
}

/**
 * When a task is due, and how worried to be about it.
 *
 * Coloured text rather than a badge: a task row already carries a status
 * badge, and two badges in a 286px column compete rather than inform.
 */
export function DueChip({ task, today }: { task: BoardTask; today: string }) {
  const label = dueLabel(task, today)
  if (!label) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        label.tone === 'danger' && 'font-medium text-status-danger',
        label.tone === 'warning' && 'text-status-warning',
        label.tone === 'neutral' && 'text-ink-subtle',
      )}
    >
      {label.tone !== 'neutral' && (
        <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      )}
      {label.text}
    </span>
  )
}

/** How many other committees are waiting on this one. */
export function OpenRequestCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="flex items-center gap-1 text-status-warning">
      <Send aria-hidden="true" className="h-3 w-3" />
      {count} asked of them
    </span>
  )
}
