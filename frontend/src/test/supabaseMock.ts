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

  /**
   * Minimal PostgREST query-builder stub.
   *
   * Chainable like the real client and resolves to an empty result, which is
   * what the settings hooks need: a query that settles rather than hanging.
   * Tests that care about returned rows override `from` directly.
   */
  const makeQuery = () => {
    const result = Promise.resolve({ data: [], error: null })
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      insert: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn(async () => ({ data: null, error: null })),
      upsert: vi.fn(async () => ({ data: null, error: null })),
      delete: vi.fn(async () => ({ data: null, error: null })),
      then: result.then.bind(result),
      catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    }
    return builder
  }

  return {
    from: vi.fn(() => makeQuery()),

    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),

      getUser: vi.fn(async () => ({
        data: { user: session?.user ?? null },
        error: null,
      })),

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

      signUp: vi.fn(async () => {
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
