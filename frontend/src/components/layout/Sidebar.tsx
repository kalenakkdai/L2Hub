import { filterNavSections, NAV_SECTIONS } from './navigation'
import { NavItem } from './NavItem'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Wordmark'

type SidebarProps = {
  name: string
  role: string
  permissions?: string[]
}

/** Persistent desktop navigation. Hidden below lg, where the drawer takes over. */
export function Sidebar({ name, role, permissions }: SidebarProps) {
  const sections = filterNavSections(NAV_SECTIONS, permissions)
  const showNotifications = permissions?.includes('notifications.view_own') ?? false

  return (
    <div className="on-navy flex h-full w-64 flex-col bg-navy-900">
      <div className="flex items-start justify-between gap-2 px-6 py-5">
        <Wordmark />
        {showNotifications ? <NotificationBell /> : null}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-6 pb-4">
        {sections.map((section, index) => (
          <div key={section.title ?? 'primary'} className={index > 0 ? 'mt-6' : undefined}>
            {section.title && (
              <p className="mb-2 px-3 text-[0.6875rem] font-semibold tracking-wider text-navy-ink-muted/70 uppercase">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-navy-700 px-6 py-4">
        <UserMenu name={name} role={role} />
      </div>
    </div>
  )
}
