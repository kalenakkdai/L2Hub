import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  icon?: LucideIcon
  /** Optional call to action, e.g. a button that creates the first item. */
  action?: ReactNode
}

/**
 * Shown when a section legitimately has nothing in it — not an error, so it
 * gets a dashed outline rather than a card, and no alert role.
 */
export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-border-strong bg-surface-sunken px-6 py-8 text-center">
      {Icon && (
        <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
          <Icon aria-hidden="true" className="h-5 w-5 text-ink-subtle" />
        </span>
      )}
      <p className="font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-subtle">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
