import { BookOpen, Calendar, CircleAlert, GraduationCap, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { dateStamp, timeOfDay } from './formatDate'
import type { CommitteeSnapshot, LiveDebrief, UpcomingItem } from './types'

function RailSection({ title, action, children }: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function CommitteeCard({ snapshot }: { snapshot: CommitteeSnapshot }) {
  return (
    <div>
      <p className="font-semibold text-ink">{snapshot.name}</p>
      <p className="mt-0.5 text-[13px] text-ink-subtle">{snapshot.status}</p>

      <div className="mt-3.5 mb-2 flex items-center justify-between text-[13px] text-ink-muted">
        <span>Readiness</span>
        <span className="font-semibold text-ink">{snapshot.readinessPct}%</span>
      </div>
      <ProgressBar
        value={snapshot.readinessPct}
        max={100}
        delayMs={400}
        label={`${snapshot.name} crew readiness`}
      />

      {snapshot.actionItemCount > 0 && (
        <Link
          to={snapshot.to}
          className="mt-3 flex items-center gap-2 rounded-control border border-status-warning-border bg-status-warning-bg px-3 py-2.5 text-[13px] text-status-warning transition duration-[260ms] ease-out-quick hover:scale-[1.015]"
        >
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {snapshot.actionItemCount} action items assigned to you
        </Link>
      )}
    </div>
  )
}

/** The participation swarm: one dot per camper, coloured by debrief state. */
function DebriefBubbles({ debrief }: { debrief: LiveDebrief }) {
  const groups = [
    { count: debrief.submitted, className: 'bg-accent-600', label: 'submitted' },
    { count: debrief.writing, className: 'bg-status-amber', label: 'writing' },
    { count: debrief.notStarted, className: 'bg-status-danger', label: 'not started' },
    { count: debrief.absent, className: 'bg-border-dotted', label: 'absent' },
  ]

  const total = groups.reduce((sum, group) => sum + group.count, 0)

  return (
    <div>
      <p className="text-[13px] text-ink-subtle">
        {debrief.title} · {debrief.session}
      </p>

      <div
        role="img"
        aria-label={groups.map((g) => `${g.count} ${g.label}`).join(', ') + `, of ${total} campers`}
        className="my-3 flex flex-wrap gap-[5px]"
      >
        {groups.flatMap((group) =>
          Array.from({ length: group.count }, (_, index) => (
            <span
              key={`${group.label}-${index}`}
              className={`h-[9px] w-[9px] rounded-full ${group.className}`}
            />
          )),
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
        {groups.map((group) => (
          <div key={group.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${group.className}`} />
            <dt className="sr-only">{group.label}</dt>
            <dd>
              {group.count} {group.label}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const QUICK_LINKS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Resources', to: '/resources', icon: BookOpen },
  { label: 'Calendar', to: '/events', icon: Calendar },
  { label: 'Crews', to: '/committees', icon: UsersRound },
  { label: 'Grades', to: '/grades', icon: GraduationCap },
]

type DashboardRailProps = {
  committee: CommitteeSnapshot | null
  debrief: LiveDebrief | null
  upcoming: UpcomingItem[]
}

/**
 * The secondary column: what your committee is doing, what is happening live,
 * and what is coming. Everything here is scannable in one pass.
 */
export function DashboardRail({ committee, debrief, upcoming }: DashboardRailProps) {
  return (
    <div className="flex flex-col gap-7">
      {committee && (
        <RailSection title="My crew">
          <CommitteeCard snapshot={committee} />
        </RailSection>
      )}

      {debrief && (
        <RailSection
          title="Live debrief"
          action={
            <Link to={debrief.to} className="ml-auto text-[12.5px] text-accent-ink underline-offset-2 hover:underline">
              Monitor
            </Link>
          }
        >
          <DebriefBubbles debrief={debrief} />
        </RailSection>
      )}

      {upcoming.length > 0 && (
        <RailSection title="Upcoming">
          <ul className="flex flex-col gap-px">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link
                  to="/events"
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition duration-[260ms] ease-out-quick hover:translate-x-0.5 hover:bg-surface-muted"
                >
                  <span className="w-11 shrink-0 font-mono text-[11.5px] text-ink-subtle">
                    {dateStamp(item.startsAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {item.title}
                  </span>
                  <time
                    dateTime={item.startsAt}
                    className="shrink-0 text-[12.5px] text-ink-subtle"
                  >
                    {timeOfDay(item.startsAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </RailSection>
      )}

      <RailSection title="Quick access">
        <ul className="grid grid-cols-2 gap-2">
          {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
            <li key={label}>
              <Link
                to={to}
                className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface p-3 text-[13px] text-ink-muted transition duration-[420ms] ease-out-quick hover:scale-[1.015] hover:border-accent-600 hover:text-accent-ink hover:shadow-card-hover hover:duration-[260ms]"
              >
                <Icon aria-hidden="true" className="h-4 w-4 text-accent-ink" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </RailSection>
    </div>
  )
}
