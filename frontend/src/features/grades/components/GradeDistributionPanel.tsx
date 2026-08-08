import { useId, useState } from 'react'
import type { GradeDistribution } from '../types'
import { summarizeGradeDistribution } from '../utils/distribution'

export interface GradeDistributionPanelProps {
  distribution: GradeDistribution
  assignmentTitle: string
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value}%`
}

/**
 * Collapsed by default. The button reveals mean, median, and a cohort
 * distribution bar — never individual peer scores.
 */
export function GradeDistributionPanel({
  distribution,
  assignmentTitle,
}: GradeDistributionPanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const summary = summarizeGradeDistribution(distribution)
  const maxCount = Math.max(1, ...summary.buckets.map((bucket) => bucket.count))

  return (
    <div className="mt-2">
      <button
        type="button"
        className="rounded-control border border-border-strong bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide grade distribution' : 'Show grade distribution'}
      </button>

      {open ? (
        <div
          id={panelId}
          className="mt-2 rounded-control border border-border-subtle bg-surface-sunken/60 px-3 py-2.5"
          aria-label={`Grade distribution for ${assignmentTitle}`}
        >
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-ink-subtle">Mean</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatPercent(summary.mean)}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-ink-subtle">Median</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatPercent(summary.median)}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-ink-subtle">Graded</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {summary.scoredCount}
              </dd>
            </div>
            {summary.yourPercent !== null ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-ink-subtle">You</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {formatPercent(summary.yourPercent)}
                </dd>
              </div>
            ) : null}
          </dl>

          <div
            className="mt-3 flex items-end gap-1.5"
            role="img"
            aria-label={summary.buckets
              .map((bucket) => `${bucket.label}: ${bucket.count}`)
              .join(', ')}
          >
            {summary.buckets.map((bucket) => {
              const barHeight =
                bucket.count === 0
                  ? 4
                  : Math.max(10, Math.round((bucket.count / maxCount) * 48))
              return (
                <div
                  key={bucket.label}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[10px] tabular-nums text-ink-subtle">
                    {bucket.count}
                  </span>
                  <div
                    className="w-full rounded-t-sm bg-accent-600/80"
                    style={{ height: `${barHeight}px` }}
                    title={`${bucket.label}: ${bucket.count}`}
                  />
                  <span className="text-[10px] leading-none text-ink-subtle">
                    {bucket.label}
                  </span>
                </div>
              )
            })}
          </div>

          {summary.mean !== null || summary.median !== null ? (
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-border-subtle">
              {summary.mean !== null ? (
                <span
                  className="absolute top-0 h-full w-0.5 bg-accent-600"
                  style={{ left: `calc(${Math.min(100, summary.mean)}% - 1px)` }}
                  title={`Mean ${summary.mean}%`}
                />
              ) : null}
              {summary.median !== null ? (
                <span
                  className="absolute top-0 h-full w-0.5 bg-navy-700"
                  style={{
                    left: `calc(${Math.min(100, summary.median)}% - 1px)`,
                  }}
                  title={`Median ${summary.median}%`}
                />
              ) : null}
              {summary.yourPercent !== null ? (
                <span
                  className="absolute top-0 h-full w-1 rounded-full bg-status-info"
                  style={{
                    left: `calc(${Math.min(100, summary.yourPercent)}% - 2px)`,
                  }}
                  title={`You ${summary.yourPercent}%`}
                />
              ) : null}
            </div>
          ) : null}

          <p className="mt-1.5 text-[10px] text-ink-subtle">
            Green tick = mean · Navy tick = median
            {summary.yourPercent !== null ? ' · Blue = your score' : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}
