import type { Session } from '@supabase/supabase-js'
import type { CurrentUser } from '../api/auth'

const DEV_SESSION_KEY = 'l2hub.dev-auth-session'

export function isDevAuthEnabled(): boolean {
  return (
    import.meta.env.MODE === 'development' &&
    import.meta.env.VITE_DEV_AUTH_ENABLED === 'true' &&
    Boolean(import.meta.env.VITE_DEV_AUTH_EMAIL) &&
    Boolean(import.meta.env.VITE_DEV_AUTH_PASSWORD)
  )
}

export function getDevCredentials(): { email: string; password: string } | null {
  if (!isDevAuthEnabled()) return null
  return {
    email: import.meta.env.VITE_DEV_AUTH_EMAIL,
    password: import.meta.env.VITE_DEV_AUTH_PASSWORD,
  }
}

function buildDevSession(email: string): Session {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: 'local-development-only',
    refresh_token: 'local-development-only',
    expires_in: 86_400,
    expires_at: now + 86_400,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Kalena Dai' },
      identities: [],
      created_at: '2026-08-06T00:00:00.000Z',
      updated_at: '2026-08-06T00:00:00.000Z',
      is_anonymous: false,
    },
  } as Session
}

export function restoreDevSession(): Session | null {
  if (!isDevAuthEnabled() || typeof window === 'undefined') return null
  const active = window.localStorage.getItem(DEV_SESSION_KEY)
  if (active !== 'true') return null
  return buildDevSession(import.meta.env.VITE_DEV_AUTH_EMAIL)
}

export function signInWithDevCredentials(
  email: string,
  password: string,
): Session {
  const credentials = getDevCredentials()
  if (
    !credentials ||
    credentials.email.toLowerCase() !== email.trim().toLowerCase() ||
    credentials.password !== password
  ) {
    throw new Error('Invalid login credentials')
  }

  window.localStorage.setItem(DEV_SESSION_KEY, 'true')
  return buildDevSession(credentials.email)
}

export function signOutDevSession(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DEV_SESSION_KEY)
  }
}

export function getDevCurrentUser(): CurrentUser | null {
  const session = restoreDevSession()
  if (!session) return null
  return {
    id: session.user.id,
    email: session.user.email ?? import.meta.env.VITE_DEV_AUTH_EMAIL,
    full_name: 'Kalena Dai',
    role: 'adviser',
    created_at: session.user.created_at,
  }
}
