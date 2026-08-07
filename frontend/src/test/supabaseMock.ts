import { vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'

/**
 * A stand-in for the Supabase client.
 *
 * Tests drive it through the `__` helpers: `__emit` fires an auth state
 * change the way the real client would after a token refresh fails, and
 * `__setSession` seeds what `getSession()` returns on mount.
 */
export type AuthChangeHandler = (event: string, session: Session | null) => void

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'student@example.edu',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: makeUser(),
    ...overrides,
  } as Session
}

export function createSupabaseMock(initialSession: Session | null = null) {
  let session = initialSession
  const handlers = new Set<AuthChangeHandler>()

  const emit = (event: string, next: Session | null) => {
    session = next
    for (const handler of handlers) handler(event, next)
  }

  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),

      onAuthStateChange: vi.fn((handler: AuthChangeHandler) => {
        handlers.add(handler)
        return {
          data: {
            subscription: {
              id: 'test-subscription',
              callback: handler,
              unsubscribe: () => {
                handlers.delete(handler)
              },
            },
          },
        }
      }),

      signInWithPassword: vi.fn(async () => {
        const next = makeSession()
        emit('SIGNED_IN', next)
        return { data: { session: next, user: next.user }, error: null }
      }),

      signOut: vi.fn(async () => {
        emit('SIGNED_OUT', null)
        return { error: null }
      }),
    },

    /** Seed the session `getSession()` resolves with. */
    __setSession(next: Session | null) {
      session = next
    },
    /** Fire an auth state change, as the real client does. */
    __emit: emit,
    __currentSession: () => session,
  }
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>
