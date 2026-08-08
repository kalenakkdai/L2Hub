import { ArrowRight, ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Section } from '../../components/ui/Section'
import { Skeleton } from '../../components/ui/Skeleton'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { dateStamp, timeOfDay } from '../dashboard/formatDate'
import { useCommittee } from './useCommittees'
import type { CommitteeDetail } from './types'

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function Roster({ committee }: { committee: CommitteeDetail }) {
  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
      <ul>
        {committee.members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3.5 border-b border-border-divider px-5 py-3 transition duration-[260ms] ease-out-quick last:border-b-0 hover:bg-surface-muted"
          >
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-[11.5px] font-semibold text-accent-ink"
            >
              {initials(member.name)}
            </span>
            <span className="text-sm font-medium text-ink">{member.name}</span>
            <span className="ml-auto text-right text-[13px] text-ink-subtle">
              {member.position ? `${member.position} · ` : ''}
              {member.isHead ? 'Crew head' : 'Camper'}
            </span>
          </li>
        ))}
      </ul>

      <p className="px-5 py-3 text-[13px] text-ink-subtle">
        {committee.remainingCount > 0
          ? `and ${committee.remainingCount} more campers`
          : 'That is the whole crew.'}
      </p>
    </div>
  )
}

export function CommitteeDetailPage() {
  const { committeeId } = useParams<{ committeeId: string }>()
  const me = useCurrentUser()
  const query = useCommittee(committeeId)

  if (me.shell) return me.shell
  const { profile, name, committee: myCommittee } = me

  const data = query.data

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-5 pb-5 sm:px-6 lg:px-10">
      <Link
        to="/committees"
        className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-ink-subtle transition hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        All crews
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-display font-bold text-ink">
            {data ? data.name : query.isPending ? 'Loading…' : 'Crew'}
          </h1>
          {data && (
            <p className="mt-1.5 text-[13.5px] text-ink-subtle">
              {data.camperCount} campers ·{' '}
              {data.head ? `Crew head ${data.head}` : 'No crew head yet'} ·{' '}
              {data.email}
            </p>
          )}
        </div>

        {data && (
          <ButtonLink to={`mailto:${data.email}`} size="sm">
            Message crew
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </ButtonLink>
        )}
      </div>
    </header>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={myCommittee}
      permissions={profile.permissions}
      header={header}
    >
      {query.isPending && (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading crew…</span>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      )}

      {query.isError && (
        <ErrorState
          title="Could not load this crew"
          description="The crew did not come back. Try again in a moment."
          onRetry={() => void query.refetch()}
        />
      )}

      {query.isSuccess && !data && (
        <ErrorState
          title="No such crew"
          description="This crew does not exist, or it has been renamed."
        />
      )}

      {data && (
        <div className="flex flex-col gap-8">
          <Section title="Campers">
            <Roster committee={data} />
          </Section>

          <Section title="Crew tasks" revealIndex={1}>
            {data.tasks.length === 0 ? (
              <EmptyState
                title="Nothing set up here yet"
                description="Tasks assigned to this crew will land here."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center gap-4 rounded-card border border-border-subtle bg-surface px-5 py-4 shadow-card transition duration-[420ms] ease-out-quick hover:-translate-y-[3px] hover:border-accent-200 hover:shadow-card-hover hover:duration-[260ms]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{task.title}</p>
                      <p className="mt-0.5 text-[13.5px] text-ink-subtle">{task.meta}</p>
                    </div>
                    <span className="shrink-0 rounded-[5px] border border-status-neutral-border bg-status-neutral-bg px-2 py-0.5 text-xs font-medium text-status-neutral">
                      {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Upcoming events" revealIndex={2}>
            {data.events.length === 0 ? (
              <EmptyState
                title="Nothing set up here yet"
                description="This crew has no events on the calendar."
              />
            ) : (
              <ul className="overflow-hidden rounded-card border border-border-subtle bg-surface">
                {data.events.map((event) => (
                  <li key={event.id}>
                    <Link
                      to="/events"
                      className="flex items-center gap-3.5 border-b border-border-divider px-5 py-3.5 text-sm text-ink transition duration-[260ms] ease-out-quick last:border-b-0 hover:translate-x-0.5 hover:bg-surface-muted"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-ink-subtle">
                        {dateStamp(event.startsAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {event.title}
                      </span>
                      <span className="shrink-0 text-[13px] text-ink-subtle">
                        {timeOfDay(event.startsAt)} · {event.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </AppShell>
  )
}
