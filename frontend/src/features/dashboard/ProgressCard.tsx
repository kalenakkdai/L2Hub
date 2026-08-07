import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import type { ProgressSummary } from './types'

/** Participation, points, and level — the "how am I doing" panel. */
export function ProgressCard({ progress }: { progress: ProgressSummary }) {
  const pointsRemaining = Math.max(0, progress.pointsToNextLevel - progress.points)

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label font-semibold tracking-wider text-ink-subtle uppercase">
          Level {progress.level}
        </span>
        <span className="text-label text-ink-subtle">{progress.participationRate}% active</span>
      </div>

      <p className="mt-1 text-title font-semibold text-ink">{progress.levelTitle}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold text-ink tabular-nums">
            {progress.points.toLocaleString()}
          </span>
          <span className="text-sm text-ink-muted tabular-nums">
            / {progress.pointsToNextLevel.toLocaleString()} pts
          </span>
        </div>

        <ProgressBar
          className="mt-3"
          value={progress.points}
          max={progress.pointsToNextLevel}
          label={`Points toward level ${progress.level + 1}`}
        />

        <p className="mt-2 text-sm text-ink-muted">
          {pointsRemaining > 0
            ? `${pointsRemaining.toLocaleString()} points to level ${progress.level + 1}`
            : `Ready for level ${progress.level + 1}`}
        </p>
      </div>

      <div className="mt-auto border-t border-border-subtle pt-4">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink tabular-nums">
            {progress.eventsAttended}
          </span>{' '}
          of{' '}
          <span className="tabular-nums">{progress.eventsPossible}</span> events attended
        </p>
      </div>
    </Card>
  )
}
