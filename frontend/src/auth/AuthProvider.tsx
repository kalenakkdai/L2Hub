import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthStatus, type SignOutReason } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    let active = true

    // Restore whatever the Supabase client persisted, so a page refresh does
    // not bounce a signed-in user to the login screen.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setStatus(data.session ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setStatus('unauthenticated')
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')

      if (event === 'SIGNED_OUT') {
        // Covers sign-outs we did not initiate — most importantly a refresh
        // token the client could not renew. Cached data belongs to the user
        // who just left, so it must not survive into the next session.
        queryClient.clear()
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setSessionExpired(false)
  }, [])

  const signOut = useCallback(
    async (reason: SignOutReason = 'manual') => {
      setSessionExpired(reason === 'expired')
      try {
        await supabase.auth.signOut()
      } catch {
        // Signing out locally is what matters, and it happens below either
        // way. Rethrowing would leave callers with a rejected promise for an
        // operation that, from the user's point of view, succeeded.
      }
      queryClient.clear()
      setSession(null)
      setStatus('unauthenticated')
    },
    [queryClient],
  )

  const clearSessionExpired = useCallback(() => setSessionExpired(false), [])

  const value = useMemo(
    () => ({ session, status, sessionExpired, signIn, signOut, clearSessionExpired }),
    [session, status, sessionExpired, signIn, signOut, clearSessionExpired],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
