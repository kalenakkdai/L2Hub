import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NAV_SECTIONS } from './navigation'
import { NavItem } from './NavItem'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Wordmark'

type MobileNavigationProps = {
  name: string
  role: string
}

/**
 * Compact navigation below lg: a sticky bar plus a slide-over drawer holding
 * the same destinations as the desktop sidebar.
 */
export function MobileNavigation({ name, role }: MobileNavigationProps) {
  const [open, setOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Escape closes, focus moves into the drawer, and the page behind it stops
  // scrolling — the three things a keyboard or screen reader user needs.
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
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Mouse convenience only, and hidden from assistive tech: it would
           * otherwise duplicate the close button's accessible name. Keyboard
           * users close with Escape or the button inside the drawer. */}
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

            <nav aria-label="Main" className="flex-1 overflow-y-auto px-6 pb-4">
              {NAV_SECTIONS.map((section, index) => (
                <div
                  key={section.title ?? 'primary'}
                  className={index > 0 ? 'mt-6' : undefined}
                >
                  {section.title && (
                    <p className="mb-2 px-3 text-[0.6875rem] font-semibold tracking-wider text-navy-ink-muted/70 uppercase">
                      {section.title}
                    </p>
                  )}
                  <ul className="flex flex-col gap-0.5">
                    {section.items.map((item) => (
                      <li key={item.to}>
                        <NavItem item={item} onNavigate={() => setOpen(false)} />
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
        </div>
      )}
    </>
  )
}
