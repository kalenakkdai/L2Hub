import type { ReactNode } from 'react'

/**
 * Centred full-screen slot used before the shell can render — while auth
 * resolves, or when the page has nothing to frame yet.
 *
 * A div rather than a p, because callers pass cards as well as text.
 */
export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-ink-muted">
      <div className="w-full max-w-md text-center">{children}</div>
    </main>
  )
}
