import { filterNavSections, NAV_SECTIONS } from './navigation'
import { NavItem } from './NavItem'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Wordmark'

type SidebarProps = {
  name: string
  role: string
  committee?: string | null
  permissions?: string[]
  /** Campsites visible on the Quad, shown under the wordmark. */
  campsiteCount?: number
}

/** Persistent desktop navigation. Hidden below lg, where the drawer takes over. */
export function Sidebar({
  name,
  role,
  committee,
  permissions,
  campsiteCount,
}: SidebarProps) {
  const sections = filterNavSections(NAV_SECTIONS, permissions)
  const showNotifications = permissions?.includes('notifications.view_own') ?? false

  return (
    <div className="on-navy flex h-full w-60 flex-col bg-navy-900 py-5">
      <div className="flex items-start justify-between gap-2 px-4 pb-4">
        <Wordmark
          switchable
          subline={
            campsiteCount === undefined
              ? undefined
              : `${campsiteCount} Campsites on the Quad`
          }
        />
        {showNotifications ? <NotificationBell /> : null}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5">
        {sections.map((section, index) => (
          <div key={section.title ?? 'primary'} className={index > 0 ? 'mt-3.5' : undefined}>
            {section.title && (
              <p className="px-2.5 pt-3.5 pb-1.5 text-[11.5px] font-semibold text-navy-ink-subtle">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-px">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-4 pt-3.5">
        <div className="border-t border-white/11 pt-3.5">
          <UserMenu name={name} role={role} committee={committee} />
        </div>
      </div>
    </div>
  )
}
