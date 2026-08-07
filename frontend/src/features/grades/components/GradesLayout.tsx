import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '../../../api/auth'
import { ApiError, SessionExpiredError } from '../../../api/client'
import { useSignOutOnExpiry } from '../../../auth/useSignOutOnExpiry'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'

/**
 * Grades route chrome: reuses the shared dashboard AppShell so navigation,
 * account menu, and design tokens stay consistent across the product.
 */
export function GradesLayout() {
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      if (error instanceof SessionExpiredError) return false
      if (error instanceof ApiError && error.status < 500) return false
      return failureCount < 2
    },
  })

  useSignOutOnExpiry(meQuery.error)

  if (meQuery.isPending) {
    return <FullPageMessage>Loading your profile…</FullPageMessage>
  }

  if (meQuery.error instanceof SessionExpiredError) {
    return <FullPageMessage>Signing you out…</FullPageMessage>
  }

  if (meQuery.isError) {
    const forbidden =
      meQuery.error instanceof ApiError && meQuery.error.status === 403

    return (
      <FullPageMessage>
        <ErrorState
          variant={forbidden ? 'unauthorized' : 'error'}
          title={
            forbidden ? 'You do not have access' : 'Could not load your profile'
          }
          description={
            meQuery.error instanceof Error
              ? meQuery.error.message
              : 'Something went wrong. Please try again.'
          }
          onRetry={forbidden ? undefined : () => void meQuery.refetch()}
        />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const name = me.full_name ?? me.email

  return (
    <AppShell name={name} role={me.role} contentClassName="lg:py-6">
      <Outlet />
    </AppShell>
  )
}
