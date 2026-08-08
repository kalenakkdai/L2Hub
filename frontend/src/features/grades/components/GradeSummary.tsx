import type { CategoryGradeSummary, GradebookSummary } from '../types'
import { formatScore } from '../utils/format'

export interface GradeSummaryProps {
  summary: GradebookSummary
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-[11px] font-medium text-ink-subtle">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

function CategoryRow({ row }: { row: CategoryGradeSummary }) {
  return (
    <li className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-baseline gap-2 text-xs">
      <span className="truncate text-ink">
        {row.name}
        <span className="text-ink-subtle"> · {row.weightPercent}%</span>
      </span>
      <span className="tabular-nums text-ink-muted">
        {formatScore(
          row.scoredCount > 0 ? row.earnedPoints : null,
          row.possiblePoints > 0 ? row.possiblePoints : null,
        )}
        {row.percent !== null ? ` (${row.percent}%)` : ''}
      </span>
      <span className="tabular-nums text-ink-subtle">
        {row.weightedContribution !== null
          ? `→ ${row.weightedContribution}%`
          : '—'}
      </span>
    </li>
  )
}

/**
 * Compact summary strip — not giant KPI cards.
 * When weighted categories exist, shows Canvas-style group totals.
 */
export function GradeSummary({ summary }: GradeSummaryProps) {
  const items: Array<{ label: string; value: string }> = []

  if (typeof summary.weightedPercent === 'number') {
    items.push({
      label: 'Weighted total',
      value: `${summary.weightedPercent}%`,
    })
  }
  if (typeof summary.completed === 'number') {
    items.push({ label: 'Completed', value: String(summary.completed) })
  }
  if (typeof summary.missing === 'number') {
    items.push({ label: 'Missing', value: String(summary.missing) })
  }
  if (typeof summary.open === 'number') {
    items.push({ label: 'Open', value: String(summary.open) })
  }
  if (
    typeof summary.earnedPoints === 'number' &&
    typeof summary.possiblePoints === 'number'
  ) {
    items.push({
      label: 'Raw points',
      value: `${summary.earnedPoints} / ${summary.possiblePoints}`,
    })
  }

  const breakdown = summary.categoryBreakdown ?? []

  if (items.length === 0 && breakdown.length === 0) return null

  return (
    <section
      aria-label="Grade summary"
      className="rounded-card border border-border-subtle bg-surface px-3 py-2 shadow-xs"
    >
      {items.length > 0 ? (
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {items.map((item) => (
            <Metric key={item.label} label={item.label} value={item.value} />
          ))}
        </dl>
      ) : null}

      {breakdown.length > 0 ? (
        <div
          className={items.length > 0 ? 'mt-3 border-t border-border-subtle pt-2' : ''}
        >
          <p className="text-[11px] font-semibold text-ink-subtle">
            Categories (points within each group, then weighted)
          </p>
          <ul className="mt-2 space-y-1.5" aria-label="Category weights">
            {breakdown.map((row) => (
              <CategoryRow key={row.categoryId} row={row} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
