import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { roleLabel } from '../../api/auth'
import { initials } from '../../lib/initials'

type UserMenuProps = {
  name: string
  role: string
  /** The camper's committee, when they have one. */
  committee?: string | null
  className?: string
}

/** Identity plus the way out, pinned to the bottom of the navigation. */
export function UserMenu({ name, role, committee, className }: UserMenuProps) {
  const { signOut } = useAuth()

  return (
    <div className={className}>
      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-accent-600 text-xs font-semibold text-white"
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-navy-ink">{name}</span>
          {/* Role and committee stay separate elements rather than one
              concatenated string, so each is addressable on its own. */}
          <span className="block truncate text-[11.5px] text-navy-ink-subtle">
            <span>{roleLabel(role)}</span>
            {committee && (
              <>
                <span aria-hidden="true"> · </span>
                <span>{committee}</span>
              </>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void signOut('manual')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-navy-ink-subtle transition duration-[260ms] ease-out-quick hover:bg-white/8 hover:text-navy-ink"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Log out</span>
        </button>
      </div>
    </div>
  )
}
