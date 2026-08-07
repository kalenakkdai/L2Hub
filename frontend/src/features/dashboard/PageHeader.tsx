import { roleLabel } from '../../api/auth'
import { StatusBadge } from '../../components/ui/StatusBadge'

type PageHeaderProps = {
  name: string
  role: string
  committee: string | null
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The largest type on the page. Nothing else competes with it, which is what
 * makes the rest of the hierarchy readable.
 */
export function PageHeader({ name, role, committee }: PageHeaderProps) {
  const firstName = name.trim().split(/\s+/)[0]

  return (
    <header>
      <h1 className="text-display font-semibold text-ink">
        {greeting(new Date().getHours())}, {firstName}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <StatusBadge tone="accent">{roleLabel(role)}</StatusBadge>
        {committee && (
          <>
            <span aria-hidden="true" className="text-ink-subtle">
              ·
            </span>
            <span>{committee}</span>
          </>
        )}
      </div>
    </header>
  )
}
