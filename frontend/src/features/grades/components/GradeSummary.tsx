import type { GradebookSummary } from '../types'

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

/**
 * Compact summary strip — not giant KPI cards.
 * Only renders metrics the provider actually supplied.
 */
export function GradeSummary({ summary }: GradeSummaryProps) {
  const items: Array<{ label: string; value: string }> = []

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
      label: 'Current points',
      value: `${summary.earnedPoints} / ${summary.possiblePoints}`,
    })
  }
  if (typeof summary.completionPercent === 'number') {
    items.push({
      label: 'Completion',
      value: `${summary.completionPercent}%`,
    })
  }

  if (items.length === 0) return null

  return (
    <section
      aria-label="Grade summary"
      className="rounded-card border border-border-subtle bg-surface px-3 py-2 shadow-xs"
    >
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <Metric key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>
    </section>
  )
}
