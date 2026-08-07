import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from './Card'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  /** Optional call to action, e.g. a button that creates the first item. */
  action?: ReactNode
}

/** Shown when a section legitimately has nothing in it — not an error. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-status-neutral-bg">
        <Icon aria-hidden="true" className="h-5 w-5 text-ink-subtle" />
      </span>
      <p className="mt-3 font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}
