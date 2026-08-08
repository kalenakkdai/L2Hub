import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorState } from '../../../components/ui/ErrorState'
import { fetchWrappedRecap, type RecapTheme } from '../api'

const CARD = 'rounded-card border border-white/12 bg-white/[0.06] p-3'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={CARD}>
      <p className="text-[11px] font-medium tracking-wide text-navy-ink-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-navy-ink">{value}</p>
    </div>
  )
}

function ThemeList({ title, themes }: { title: string; themes: RecapTheme[] }) {
  if (themes.length === 0) return null
  return (
    <div className={CARD}>
      <p className="text-[11px] font-medium tracking-wide text-navy-ink-muted uppercase">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {themes.map((theme) => (
          <li key={theme.id}>
            <p className="text-sm font-medium text-navy-ink">
              {theme.label}{' '}
              <span className="text-xs font-normal text-navy-ink-muted">
                · {theme.mentions} mentions
              </span>
            </p>
            <p className="text-xs text-navy-ink-muted">{theme.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The Wrapped recap that drops down under an event row, once the class has
 * been through the full Wrapped. Loads only when the row is expanded.
 */
export function EventRecapPanel({ eventRef }: { eventRef: string }) {
  const recapQuery = useQuery({
    queryKey: ['events', eventRef, 'recap'],
    queryFn: () => fetchWrappedRecap(eventRef),
  })

  if (recapQuery.isPending) {
    return <p className="p-4 text-sm text-navy-ink-muted">Loading recap…</p>
  }

  if (recapQuery.isError || !recapQuery.data) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load recap"
          description="Open the full Wrapped instead."
          onRetry={() => void recapQuery.refetch()}
        />
      </div>
    )
  }

  const recap = recapQuery.data
  const rating = recap.overallRating
  const participation = recap.participation

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-200/80 uppercase">
            Wrapped recap
          </p>
          {recap.hero ? (
            <p className="mt-0.5 text-sm text-navy-ink-muted">{recap.hero.tagline}</p>
          ) : null}
        </div>
        <Link
          to={`/events/${eventRef}/wrapped`}
          className="text-xs font-medium text-emerald-200 underline"
        >
          Replay full Wrapped
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rating ? (
          <Stat label="Overall rating" value={`${rating.score} / ${rating.max}`} />
        ) : null}
        {participation ? (
          <Stat
            label="Debrief completion"
            value={`${participation.completionPercent}%`}
          />
        ) : null}
        {participation ? (
          <Stat
            label="Submitted"
            value={`${participation.submitted} / ${participation.invited}`}
          />
        ) : null}
      </div>

      {recap.summary ? (
        <div className={CARD}>
          <p className="text-[11px] font-medium tracking-wide text-navy-ink-muted uppercase">
            Executive summary
          </p>
          <p className="mt-1 text-sm text-navy-ink">{recap.summary}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeList title="Top strengths" themes={recap.topStrengths} />
        <ThemeList title="Top improvements" themes={recap.topImprovements} />
      </div>

      {recap.committeeRankings.length > 0 ? (
        <div className={CARD}>
          <p className="text-[11px] font-medium tracking-wide text-navy-ink-muted uppercase">
            Committee ratings
          </p>
          <ul className="mt-2 space-y-1">
            {recap.committeeRankings.map((committee) => (
              <li
                key={committee.name}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-navy-ink">{committee.name}</span>
                <span className="tabular-nums text-navy-ink-muted">
                  {committee.rating}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recap.recommendedActions.length > 0 ? (
        <div className={CARD}>
          <p className="text-[11px] font-medium tracking-wide text-navy-ink-muted uppercase">
            Recommended actions
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-ink">
            {recap.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
