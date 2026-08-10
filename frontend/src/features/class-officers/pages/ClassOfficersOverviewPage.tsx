import { Link } from 'react-router-dom'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { useClassOfficersSnapshot } from '../hooks/useClassOfficers'
import { useClassOfficersContext } from '../context/ClassOfficersProvider'
import { classOfficersPath } from '../lib/paths'
import { centsToDollars, fundraiserPercent, homecomingCompletion } from '../lib/progress'

export function ClassOfficersOverviewPage() {
  const { cohort } = useClassOfficersContext()
  const snapshot = useClassOfficersSnapshot()

  if (snapshot.isPending) {
    return <p className="text-sm text-ink-muted">Loading Class Officers progress…</p>
  }
  if (snapshot.isError || !snapshot.data) {
    return (
      <ErrorState
        title="Could not load progress"
        description="Try again in a moment."
        onRetry={() => void snapshot.refetch()}
      />
    )
  }

  const { fundraiser, homecoming, advisors, officers } = snapshot.data
  const raisedPct = fundraiserPercent(fundraiser)
  const hoco = homecomingCompletion(homecoming)

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Fundraiser</h2>
            <p className="mt-1 text-xs text-ink-muted">{fundraiser.label}</p>
          </div>
          <Link
            to={classOfficersPath(cohort, 'fundraiser')}
            className="text-xs font-medium text-status-info hover:underline"
          >
            Open fundraiser
          </Link>
        </div>
        <p className="mt-3 text-2xl font-semibold text-ink">
          {centsToDollars(fundraiser.raisedCents)}
          <span className="text-base font-normal text-ink-muted">
            {' '}
            of {centsToDollars(fundraiser.targetCents)}
          </span>
        </p>
        <p className="mt-1 text-xs text-ink-subtle">{raisedPct}% raised</p>
        <div className="mt-3">
          <ProgressBar
            value={fundraiser.raisedCents}
            max={fundraiser.targetCents}
            label="Fundraiser progress"
            className="h-2.5"
          />
        </div>
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Homecoming {homecoming.year}</h2>
            <p className="mt-1 text-xs text-ink-muted">{homecoming.skitTheme || 'Theme TBD'}</p>
          </div>
          <Link
            to={classOfficersPath(cohort, 'homecoming')}
            className="text-xs font-medium text-status-info hover:underline"
          >
            Open homecoming
          </Link>
        </div>
        <p className="mt-3 text-sm text-ink">
          {hoco.done} of {hoco.total} checkpoints done · {hoco.percent}%
        </p>
        <div className="mt-3">
          <ProgressBar
            value={hoco.done}
            max={Math.max(1, hoco.total)}
            label="Homecoming checkpoint progress"
            className="h-2.5"
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Class Officers</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            {officers.map((person) => (
              <li key={person.id}>
                {person.name}
                {person.title ? (
                  <span className="text-ink-subtle"> · {person.title}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Class Advisors</h2>
          <p className="mt-1 text-[11px] text-ink-subtle">Two per class · view only</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            {advisors.map((person) => (
              <li key={person.id}>{person.name}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
