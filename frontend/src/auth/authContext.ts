import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/** Why the last sign-out happened, so the login page can explain itself. */
export type SignOutReason = 'manual' | 'expired'

export type SignUpDetails = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export type AuthContextValue = {
  session: Session | null
  status: AuthStatus
  /** True when the session ended because it expired, not because the user left. */
  sessionExpired: boolean
  signIn: (email: string, password: string) => Promise<void>
  /**
   * Registers a camper. The name is passed as signup metadata, which the
   * auth.users trigger copies into profiles.full_name — so a camper who
   * signs up is greeted by name from their first visit.
   *
   * Resolves `needsConfirmation: true` when the project requires the camper
   * to click a link in their email before the session begins.
   */
  signUp: (details: SignUpDetails) => Promise<{ needsConfirmation: boolean }>
  signOut: (reason?: SignOutReason) => Promise<void>
  /** Dismisses the expired-session notice once it has been shown. */
  clearSessionExpired: () => void
}

// Undefined marks "no provider above me", which useAuth turns into a clear error.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
