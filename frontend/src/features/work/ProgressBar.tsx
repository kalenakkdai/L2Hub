/**
 * Progress bar for how far a camper (or the whole event) has gotten through
 * their tasks. Purely presentational — the percent comes from the server.
 */

type ProgressBarProps = {
  percent: number
  label: string
  detail?: string
  accent?: boolean
}

export function ProgressBar({
  percent,
  label,
  detail,
  accent = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={
            accent
              ? 'text-sm font-semibold text-ink'
              : 'text-sm font-medium text-ink'
          }
        >
          {label}
        </p>
        <p className="text-xs tabular-nums text-ink-subtle">
          {clamped}%{detail ? ` · ${detail}` : ''}
        </p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${clamped}% complete`}
      >
        <div
          className={
            accent
              ? 'h-full rounded-full bg-amber-500 transition-[width] duration-500'
              : 'h-full rounded-full bg-ink/70 transition-[width] duration-500'
          }
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
