import type { ReactNode } from 'react'

/** Centred single-line state, used while auth or data is resolving. */
export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
      <p>{children}</p>
    </main>
  )
}
