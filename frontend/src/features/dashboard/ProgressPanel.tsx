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

/** Current letter grade, climb toward the next band, and supporting figures. */
export function ProgressPanel({ progress }: { progress: ProgressSummary }) {
  const percent = progress.gradePercent ?? 0
  const hasGrade = progress.gradeLetter != null && progress.gradePercent != null
  const climbing =
    progress.nextBand != null &&
    progress.nextBandMin != null &&
    progress.gradePercent != null
  const remaining = climbing
    ? Math.max(0, progress.nextBandMin! - progress.gradePercent!)
    : 0

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-ink">
          {hasGrade
            ? `Grade ${progress.gradeLetter} · ${progress.gradePercent}%`
            : 'No grade yet'}
        </span>
        <span className="text-[13px] text-ink-subtle">
          {climbing
            ? remaining > 0
              ? `${remaining}% to ${progress.nextBand}`
              : `At ${progress.nextBand}`
            : hasGrade
              ? 'Top of the scale'
              : 'Graded work will land here'}
        </span>
      </div>

      <ProgressBar
        className="h-2"
        value={percent}
        max={100}
        delayMs={360}
        label={
          climbing
            ? `Progress toward ${progress.nextBand}`
            : 'Overall grade percent'
        }
      />

      <div className="mt-4 flex gap-7 border-t border-border-divider pt-4">
        <Figure value={String(progress.streakWeeks)} label="Week streak" />
        <Figure value={String(progress.tasksDone)} label="Tasks done" />
        <Figure value={`${progress.participationRate}%`} label="Participation" />
      </div>

      {progress.note && (
        <p className="mt-3.5 rounded-control border border-accent-200 bg-accent-50 px-3 py-2.5 text-[13px] text-accent-ink">
          {progress.note}
        </p>
      )}
    </Card>
  )
}
