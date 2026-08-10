import { useCountUp } from '../../components/ui/useCountUp'
import { DashboardSearch } from './DashboardSearch'
import { greetingFor } from './greeting'
import type { HeaderStats } from './types'

type DashboardHeaderProps = {
  /** Null when the camper has not given a name; the greeting drops it. */
  firstName: string | null
  stats: HeaderStats
  permissions?: string[]
}

function Stat({
  value,
  label,
  tone = 'ink',
}: {
  value: string
  label: string
  tone?: 'ink' | 'warning'
}) {
  return (
    <div className="relative border-l border-border-divider px-5 text-right last:pr-0">
      <div
        className={
          tone === 'warning'
            ? 'text-2xl leading-none font-semibold tracking-[-0.02em] text-status-warning tabular-nums'
            : 'text-2xl leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums'
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-ink-subtle">{label}</div>
    </div>
  )
}

/**
 * Sticky page header: who you are, and the three numbers that summarise your
 * standing — overall grade, percent, and open work.
 */
export function DashboardHeader({
  firstName,
  stats,
  permissions,
}: DashboardHeaderProps) {
  const percent = useCountUp(stats.gradePercent ?? 0)

  return (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-display font-bold text-ink">
            {greetingFor(firstName)}
          </h1>
        </div>

        <div className="flex items-center">
          <Stat value={stats.gradeLetter ?? '—'} label="Grade" />
          <Stat
            value={stats.gradePercent == null ? '—' : `${percent}%`}
            label="Overall"
          />
          <Stat value={String(stats.openCount)} label="Open" tone="warning" />
        </div>
      </div>

      <div className="mt-4 max-w-xl">
        <DashboardSearch permissions={permissions} />
      </div>
    </header>
  )
}
