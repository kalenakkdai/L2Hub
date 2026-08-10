import { CalendarOff, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '../auth/useCurrentUser'
import { AppShell } from '../components/layout/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Section } from '../components/ui/Section'
import { ActivityFeed } from '../features/dashboard/ActivityFeed'
import { AttentionList } from '../features/dashboard/AttentionList'
import { CalendarRail } from '../features/dashboard/CalendarRail'
import { DashboardHeader } from '../features/dashboard/DashboardHeader'
import { DashboardRail } from '../features/dashboard/DashboardRail'
import { DashboardSkeleton } from '../features/dashboard/DashboardSkeleton'
import { GradesPanel } from '../features/dashboard/GradesPanel'
import { NextEventCard } from '../features/dashboard/NextEventCard'
import { ProgressPanel } from '../features/dashboard/ProgressPanel'
import { useDashboard } from '../features/dashboard/useDashboard'

export function DashboardPage() {
  // Kept as one object so `shell` narrows `profile` to non-null below.
  const me = useCurrentUser()
  const dashboard = useDashboard()

  if (me.shell) return me.shell
  const { profile, name, firstName, committee } = me

  const data = dashboard.data

  const shellProps = {
    name,
    role: profile.role,
    committee: committee ?? data?.committee ?? null,
    permissions: profile.permissions,
    campsiteCount: data?.campsiteCount,
  }

  if (dashboard.isPending) {
    return (
      <AppShell {...shellProps}>
        <DashboardSkeleton />
      </AppShell>
    )
  }

  if (dashboard.isError || !data) {
    return (
      <AppShell {...shellProps}>
        <ErrorState
          title="Could not load your dashboard"
          description="Your account loaded, but the dashboard contents did not."
          onRetry={() => void dashboard.refetch()}
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      {...shellProps}
      header={
        <DashboardHeader
          firstName={firstName}
          stats={
            data.stats ?? {
              gradeLetter: null,
              gradePercent: null,
              openCount: 0,
            }
          }
          permissions={profile.permissions}
        />
      }
      rail={
        <DashboardRail
          committee={data.committeeSnapshot ?? null}
          debrief={data.liveDebrief ?? null}
          upcoming={data.upcoming ?? []}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <Section title="Next event">
          {data.nextEvent ? (
            <NextEventCard event={data.nextEvent} />
          ) : (
            <EmptyState
              icon={CalendarOff}
              title="Nothing scheduled"
              description="When an event needs you, it will appear here."
            />
          )}
          {(data.calendar?.length ?? 0) > 0 && (
            <CalendarRail days={data.calendar ?? []} />
          )}
        </Section>

        <Section
          title="Needs your attention"
          revealIndex={1}
          aside={<span className="text-[13px] text-ink-subtle">Ranked by urgency</span>}
        >
          {(data.attention?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Inbox}
              title="You are all caught up"
              description="Nothing is waiting on you right now."
            />
          ) : (
            <AttentionList items={data.attention ?? []} />
          )}
        </Section>

        <Section
          title="Grades"
          revealIndex={2}
          aside={
            <Link
              to="/grades"
              className="text-[13px] text-accent-ink underline-offset-2 hover:underline"
            >
              Open gradebook
            </Link>
          }
        >
          {(data.grades?.rows?.length ?? 0) === 0 ? (
            <EmptyState
              title="No assignments yet"
              description="Graded work will show up here as it is assigned."
            />
          ) : (
            <GradesPanel
              grades={
                data.grades ?? {
                  completed: 0,
                  missing: 0,
                  open: 0,
                  pointsEarned: 0,
                  pointsPossible: 0,
                  rows: [],
                }
              }
            />
          )}
        </Section>

        <Section title="My progress" revealIndex={3}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressPanel
              progress={
                data.progress ?? {
                  gradeLetter: null,
                  gradePercent: null,
                  nextBand: null,
                  nextBandMin: null,
                  streakWeeks: 0,
                  tasksDone: 0,
                  participationRate: 0,
                  note: null,
                }
              }
            />
            {(data.activity?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No activity yet"
                description="Grades, check-ins, and submissions will show up here."
              />
            ) : (
              <ActivityFeed items={data.activity ?? []} />
            )}
          </div>
        </Section>
      </div>
    </AppShell>
  )
}
