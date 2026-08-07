import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { roleLabel } from '../../api/auth'

type UserMenuProps = {
  name: string
  role: string
  /** Rendered inside dark chrome, so colours come from the navy scale. */
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Identity plus the way out, pinned to the bottom of the navigation. */
export function UserMenu({ name, role, className }: UserMenuProps) {
  const { signOut } = useAuth()

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-label font-semibold text-navy-ink"
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-navy-ink">{name}</span>
          <span className="block truncate text-label text-navy-ink-muted">
            {roleLabel(role)}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => void signOut('manual')}
        className="mt-1 flex w-full items-center gap-3 rounded-control px-3 py-2 text-sm text-navy-ink-muted transition duration-150 ease-out-quick hover:bg-navy-800 hover:text-navy-ink"
      >
        <LogOut aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
        Log out
      </button>
    </div>
  )
}
