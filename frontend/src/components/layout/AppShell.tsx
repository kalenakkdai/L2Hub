import type { ReactNode } from 'react'
import { cn } from '../ui/cn'
import { MobileNavigation } from './MobileNavigation'
import { Sidebar } from './Sidebar'

type AppShellProps = {
  name: string
  role: string
  children: ReactNode
  committee?: string | null
  permissions?: string[]
  /** Campsites visible on the Quad, shown under the wordmark. */
  campsiteCount?: number
  /** Optional overrides for pages that need denser content padding. */
  contentClassName?: string
  /** Sticky page header rendered above the scrolling content. */
  header?: ReactNode
  /**
   * Secondary column pinned to the right on wide screens. Below xl it stacks
   * beneath the main content rather than disappearing — nothing in it is
   * duplicated elsewhere, so hiding it would lose information.
   */
  rail?: ReactNode
}

/**
 * The authenticated frame: near-black sidebar on desktop, sticky bar and
 * drawer on smaller screens, white canvas for content.
 *
 * Pages render only their content and never their own chrome.
 */
export function AppShell({
  name,
  role,
  children,
  committee,
  permissions,
  campsiteCount,
  contentClassName,
  header,
  rail,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <MobileNavigation
        name={name}
        role={role}
        committee={committee}
        permissions={permissions}
      />

      {/* Fixed so long pages scroll under a stationary sidebar. */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        <Sidebar
          name={name}
          role={role}
          committee={committee}
          permissions={permissions}
          campsiteCount={campsiteCount}
        />
      </div>

      <div className="lg:pl-60">
        {header}

        <div className="flex flex-col xl:flex-row xl:items-start">
          <main
            className={cn(
              'min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:pb-11',
              contentClassName,
            )}
          >
            {children}
          </main>

          {rail && (
            <aside
              aria-label="At a glance"
              className="shrink-0 border-border-divider bg-surface-sunken px-5 py-7 xl:w-[296px] xl:self-stretch xl:border-l"
            >
              {rail}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
