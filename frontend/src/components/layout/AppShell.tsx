import type { ReactNode } from 'react'
import { MobileNavigation } from './MobileNavigation'
import { Sidebar } from './Sidebar'

type AppShellProps = {
  name: string
  role: string
  children: ReactNode
}

/**
 * The authenticated frame: fixed navy sidebar on desktop, sticky bar and
 * drawer on smaller screens, light canvas for content.
 *
 * Pages render only their content and never their own chrome.
 */
export function AppShell({ name, role, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <MobileNavigation name={name} role={role} />

      {/* Fixed so long pages scroll under a stationary sidebar. */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        <Sidebar name={name} role={role} />
      </div>

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
