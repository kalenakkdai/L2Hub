import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from './FullPageMessage'

/** Renders children only for signed-in users; everyone else goes to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  // Wait for the persisted session to load. Redirecting during this window
  // would flash the login page on every refresh for a signed-in user.
  if (status === 'loading') {
    return <FullPageMessage>Loading…</FullPageMessage>
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
