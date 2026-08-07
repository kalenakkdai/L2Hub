import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import type { ProgressSummary } from './types'

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-ink-subtle">{label}</div>
    </div>
  )
}

/** Level, points to the next one, and the three figures behind them. */
export function ProgressPanel({ progress }: { progress: ProgressSummary }) {
  const remaining = Math.max(0, progress.pointsToNextLevel - progress.points)

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-ink">
          Level {progress.level} · {progress.levelTitle}
        </span>
        <span className="text-[13px] text-ink-subtle">
          {remaining > 0
            ? `${remaining.toLocaleString()} pts to Level ${progress.level + 1}`
            : `Ready for Level ${progress.level + 1}`}
        </span>
      </div>

      <ProgressBar
        className="h-2"
        value={progress.points}
        max={progress.pointsToNextLevel}
        delayMs={360}
        label={`Points toward level ${progress.level + 1}`}
      />

      <div className="mt-4 flex gap-7 border-t border-border-divider pt-4">
        <Figure value={String(progress.streakWeeks)} label="Week streak" />
        <Figure value={String(progress.tasksDone)} label="Tasks done" />
        <Figure value={`${progress.participationRate}%`} label="Participation" />
      </div>

      {progress.note && (
        <p className="mt-3.5 rounded-control border border-accent-200 bg-accent-50 px-3 py-2.5 text-[13px] text-accent-600">
          {progress.note}
        </p>
      )}
    </Card>
  )
}
