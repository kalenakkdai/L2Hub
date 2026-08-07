import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/** Why the last sign-out happened, so the login page can explain itself. */
export type SignOutReason = 'manual' | 'expired'

export type AuthContextValue = {
  session: Session | null
  status: AuthStatus
  /** True when the session ended because it expired, not because the user left. */
  sessionExpired: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: (reason?: SignOutReason) => Promise<void>
  /** Dismisses the expired-session notice once it has been shown. */
  clearSessionExpired: () => void
}

// Undefined marks "no provider above me", which useAuth turns into a clear error.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
