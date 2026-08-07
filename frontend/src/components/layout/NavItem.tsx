import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'
import { IMPLEMENTED_ROUTES, type NavItemDefinition } from './navigation'

const BASE =
  'group relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition duration-150 ease-out-quick'

type NavItemProps = {
  item: NavItemDefinition
  onNavigate?: () => void
}

/**
 * A destination in the sidebar or drawer.
 *
 * Routes that do not exist yet render as inert rows rather than links, so
 * nothing in the navigation leads to a blank page.
 */
export function NavItem({ item, onNavigate }: NavItemProps) {
  const { icon: Icon, label, to } = item

  if (!IMPLEMENTED_ROUTES.has(to)) {
    return (
      <span
        aria-disabled="true"
        className={cn(BASE, 'cursor-default text-navy-ink-muted/60')}
      >
        <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
        <span className="truncate">{label}</span>
        <span className="ml-auto text-[0.6875rem] tracking-wide text-navy-ink-muted/60 uppercase">
          Soon
        </span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          BASE,
          isActive
            ? 'bg-navy-700 font-medium text-navy-ink'
            : 'text-navy-ink-muted hover:bg-navy-800 hover:text-navy-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* The accent rail is the only saturated pixel in the chrome. */}
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-full bg-accent-400"
            />
          )}
          <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}
