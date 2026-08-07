import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, Inbox } from 'lucide-react'
import { fetchCurrentUser } from '../api/auth'
import { ApiError, SessionExpiredError } from '../api/client'
import { useSignOutOnExpiry } from '../auth/useSignOutOnExpiry'
import { AppShell } from '../components/layout/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { SectionHeading } from '../components/ui/SectionHeading'
import { ActivityFeed } from '../features/dashboard/ActivityFeed'
import { DashboardSkeleton } from '../features/dashboard/DashboardSkeleton'
import { FeaturedEventCard } from '../features/dashboard/FeaturedEventCard'
import { ModuleGroup } from '../features/dashboard/ModuleGroup'
import { GROUP_ORDER } from '../features/dashboard/moduleGroups'
import { PageHeader } from '../features/dashboard/PageHeader'
import { ProgressCard } from '../features/dashboard/ProgressCard'
import { useDashboard } from '../features/dashboard/useDashboard'
import { FullPageMessage } from '../components/FullPageMessage'

export function DashboardPage() {
  // Logout lives in the shell's UserMenu, not on the page itself.
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

  const dashboardQuery = useDashboard()

  // A dead session signs the user out; RequireAuth then sends them to /login.
  useSignOutOnExpiry(meQuery.error)

  if (meQuery.isPending) {
    return <FullPageMessage>Loading your profile…</FullPageMessage>
  }

  // On the way out after an expiry — no error UI, just the redirect.
  if (meQuery.error instanceof SessionExpiredError) {
    return <FullPageMessage>Signing you out…</FullPageMessage>
  }

  if (meQuery.isError) {
    const forbidden = meQuery.error instanceof ApiError && meQuery.error.status === 403

    return (
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
    )
  }

  const me = meQuery.data
  const name = me.full_name ?? me.email
  const data = dashboardQuery.data

  return (
    <AppShell name={name} role={me.role}>
      {dashboardQuery.isPending ? (
        <DashboardSkeleton />
      ) : dashboardQuery.isError || !data ? (
        <div className="flex flex-col gap-8">
          <PageHeader name={name} role={me.role} committee={null} />
          <ErrorState
            title="Could not load your dashboard"
            description="Your account loaded, but the dashboard contents did not."
            onRetry={() => void dashboardQuery.refetch()}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <PageHeader name={name} role={me.role} committee={data.committee} />

          {/* Hero row: the featured item and progress sit side by side on wide
              screens so the first screen feels complete without scrolling. */}
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {data.featured ? (
                <FeaturedEventCard item={data.featured} />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Nothing scheduled"
                  description="When an event or debrief needs you, it will appear here."
                />
              )}
            </div>
            <ProgressCard progress={data.progress} />
          </div>

          {data.modules.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No modules yet"
              description="Modules appear here as your organization turns them on."
            />
          ) : (
            GROUP_ORDER.map((group) => (
              <ModuleGroup
                key={group}
                group={group}
                modules={data.modules.filter((module) => module.group === group)}
              />
            ))
          )}

          <section aria-labelledby="recent-activity">
            <SectionHeading id="recent-activity">Recent activity</SectionHeading>
            {data.activity.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No activity yet"
                description="Points, check-ins, and submissions will show up here."
              />
            ) : (
              <ActivityFeed items={data.activity} />
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
