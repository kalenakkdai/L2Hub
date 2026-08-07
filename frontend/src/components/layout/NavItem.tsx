import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'
import { IMPLEMENTED_ROUTES, type NavBadge, type NavItemDefinition } from './navigation'

const BASE =
  'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm transition duration-[420ms] ease-out-quick hover:duration-[260ms]'

function Badge({ badge }: { badge: NavBadge }) {
  if (badge.kind === 'live') {
    return (
      <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.1em] text-accent-400 uppercase">
        <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-accent-400" />
        Live
      </span>
    )
  }

  return (
    <span
      className={cn(
        'ml-auto font-mono text-[11px]',
        badge.tone === 'accent' ? 'text-accent-400' : 'text-navy-ink-subtle',
      )}
    >
      {badge.value}
    </span>
  )
}

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
  const { icon: Icon, label, to, badge } = item

  if (!IMPLEMENTED_ROUTES.has(to)) {
    return (
      <span aria-disabled="true" className={cn(BASE, 'cursor-default text-navy-ink-subtle')}>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        <span className="ml-auto font-mono text-[9.5px] tracking-[0.1em] uppercase">
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
          // Active state is the one place the accent appears in the chrome.
          isActive
            ? 'bg-accent-600 font-medium text-navy-ink'
            : 'text-navy-ink-muted hover:translate-x-0.5 hover:bg-white/8 hover:text-navy-ink',
        )
      }
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {badge && <Badge badge={badge} />}
    </NavLink>
  )
}
