import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { fetchCurrentUser, type CurrentUser } from '../api/auth'
import { ApiError, SessionExpiredError } from '../api/client'
import { FullPageMessage } from '../components/FullPageMessage'
import { ErrorState } from '../components/ui/ErrorState'
import { useSignOutOnExpiry } from './useSignOutOnExpiry'

type Ready = {
  profile: CurrentUser
  name: string
  /** The camper's committee, from their role assignments. Null if unscoped. */
  committee: string | null
  /** Null once the profile has loaded. */
  shell: null
}

type NotReady = {
  profile: null
  name: string
  committee: null
  /** What the page should render instead of itself. */
  shell: ReactElement
}

/**
 * A camper's committee comes from whichever role assignment is scoped to one.
 * Several assignments can carry a committee; the first is shown, since the
 * header has room for one.
 */
function committeeOf(profile: CurrentUser): string | null {
  return profile.roles?.find((role) => role.committee_name)?.committee_name ?? null
}

/**
 * Loads the signed-in camper, and hands back the screen to render while that
 * is pending, failing, or expiring.
 *
 * Every authenticated page needs the same four branches — loading, expired,
 * forbidden, failed — and duplicating them drifts. Pages call this, render
 * `shell` if it is set, and otherwise use `profile`.
 */
export function useCurrentUser(): Ready | NotReady {
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      // A rejected token or a refused request will be refused identically on
      // the next attempt. Only retry things that might genuinely be transient.
      if (error instanceof SessionExpiredError) return false
      if (error instanceof ApiError && error.status < 500) return false
      return failureCount < 2
    },
  })

  // A dead session signs the user out; RequireAuth then sends them to /login.
  useSignOutOnExpiry(meQuery.error)

  if (meQuery.isPending) {
    return {
      profile: null,
      name: '',
      committee: null,
      shell: <FullPageMessage>Loading your profile…</FullPageMessage>,
    }
  }

  // On the way out after an expiry — no error UI, just the redirect.
  if (meQuery.error instanceof SessionExpiredError) {
    return {
      profile: null,
      name: '',
      committee: null,
      shell: <FullPageMessage>Signing you out…</FullPageMessage>,
    }
  }

  if (meQuery.isError) {
    const forbidden = meQuery.error instanceof ApiError && meQuery.error.status === 403

    return {
      profile: null,
      name: '',
      committee: null,
      shell: (
        <FullPageMessage>
          <ErrorState
            variant={forbidden ? 'unauthorized' : 'error'}
            title={forbidden ? 'You do not have access' : 'Could not load your profile'}
            description={
              meQuery.error instanceof Error
                ? meQuery.error.message
                : 'Something went wrong. Please try again.'
            }
            onRetry={forbidden ? undefined : () => void meQuery.refetch()}
          />
        </FullPageMessage>
      ),
    }
  }

  return {
    profile: meQuery.data,
    name: meQuery.data.full_name ?? meQuery.data.email,
    committee: committeeOf(meQuery.data),
    shell: null,
  }
}
