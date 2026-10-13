import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { filterNavSections, NAV_SECTIONS } from './navigation'
import { useCampsiteChrome } from '../../hooks/useCampsiteModules'
import { NavItem } from './NavItem'
import { NotificationBell } from './NotificationBell'
import { useInboxBadge } from './useInboxBadge'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Wordmark'

type MobileNavigationProps = {
  name: string
  role: string
  committee?: string | null
  permissions?: string[]
}

/**
 * Compact navigation below lg: a sticky bar plus a slide-over drawer holding
 * the same destinations as the desktop sidebar.
 */
export function MobileNavigation({
  name,
  role,
  committee,
  permissions,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const chrome = useCampsiteChrome()
  const sections = filterNavSections(
    NAV_SECTIONS,
    permissions,
    chrome.data?.modulesEnabled,
  )
  const showNotifications = permissions?.includes('notifications.view_own') ?? false
  const inboxBadge = useInboxBadge(showNotifications)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <header className="on-navy sticky top-0 z-30 flex items-center gap-3 bg-navy-900 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          className="flex h-9 w-9 items-center justify-center rounded-control text-navy-ink-muted transition duration-150 ease-out-quick hover:bg-navy-800 hover:text-navy-ink"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </button>

        <Wordmark />
        <div className="ml-auto">{showNotifications ? <NotificationBell /> : null}</div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-950/60"
          />

          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="on-navy relative flex h-full w-72 max-w-[85%] flex-col bg-navy-900 shadow-overlay"
          >
            <div className="flex items-center justify-between px-6 py-4">
              <Wordmark />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-control text-navy-ink-muted transition duration-150 ease-out-quick hover:bg-navy-800 hover:text-navy-ink"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Close navigation</span>
              </button>
            </div>

            <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 pb-4">
              {sections.map((section, index) => (
                <div
                  key={section.title ?? 'primary'}
                  className={index > 0 ? 'mt-3.5' : undefined}
                >
                  {section.title && (
                    <p className="px-2.5 pt-3.5 pb-1.5 text-[11.5px] font-semibold text-navy-ink-subtle">
                      {section.title}
                    </p>
                  )}
                  <ul className="flex flex-col gap-px">
                    {section.items.map((item) => (
                      <li key={item.to}>
                        <NavItem
                          item={item}
                          badge={item.to === '/inbox' ? inboxBadge : undefined}
                          onNavigate={() => setOpen(false)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="mx-4 border-t border-white/11 py-3.5">
              <UserMenu name={name} role={role} committee={committee} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
