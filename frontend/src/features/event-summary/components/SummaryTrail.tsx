import { Star } from 'lucide-react'
import type { SummaryStatus } from '../api'

/**
 * The Event Summary workflow drawn as a constellation: each stage is a star,
 * lit once the event has passed through it. Reflects backend status only — it
 * never advances on its own.
 */

const STAGES = ['Requested', 'Approved', 'Generated', 'Published'] as const

/** How many stages a given backend status has completed. */
export function litStageCount(status: SummaryStatus | string): number {
  switch (status) {
    case 'not_requested':
      return 0
    case 'pending_approval':
      return 1
    case 'generating':
      return 2
    case 'generated':
      return 3
    case 'published':
    case 'archived':
      return STAGES.length
    default:
      return 0
  }
}

export function SummaryTrail({ status }: { status: SummaryStatus | string }) {
  const lit = litStageCount(status)

  return (
    <ol className="mt-5 flex flex-wrap items-start gap-x-1 gap-y-3">
      {STAGES.map((stage, index) => {
        const isLit = index < lit
        // The stage being worked on right now, rather than one already banked.
        const isCurrent = index === lit && lit < STAGES.length

        return (
          <li key={stage} className="flex items-start">
            <div
              className="flex w-24 flex-col items-center gap-1.5 text-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <Star
                aria-hidden="true"
                className={
                  isLit
                    ? 'h-5 w-5 fill-accent-400 text-accent-400 drop-shadow-[0_0_6px_rgba(61,191,135,0.7)]'
                    : isCurrent
                      ? 'h-5 w-5 text-navy-ink'
                      : 'h-5 w-5 text-navy-ink-muted/45'
                }
              />
              <span
                className={
                  isLit || isCurrent
                    ? 'text-[11px] font-semibold text-navy-ink'
                    : 'text-[11px] font-medium text-navy-ink-muted/70'
                }
              >
                {stage}
              </span>
            </div>

            {index < STAGES.length - 1 ? (
              <span
                aria-hidden="true"
                className={`mt-2.5 h-px w-6 border-t border-dashed sm:w-10 ${
                  isLit ? 'border-accent-400/70' : 'border-navy-ink-muted/30'
                }`}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
