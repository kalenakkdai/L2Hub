import { useEffect } from 'react'
import { SessionExpiredError } from '../api/client'
import { useAuth } from './useAuth'

/**
 * Sign the user out when a query fails because their session is no longer
 * valid. Pass any query error; anything that is not a SessionExpiredError is
 * left alone for the page to render as a normal failure.
 */
export function useSignOutOnExpiry(error: unknown): void {
  const { signOut } = useAuth()

  useEffect(() => {
    if (error instanceof SessionExpiredError) {
      void signOut('expired')
    }
  }, [error, signOut])
}
