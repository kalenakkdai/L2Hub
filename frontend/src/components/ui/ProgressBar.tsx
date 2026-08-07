import { cn } from './cn'

type ProgressBarProps = {
  value: number
  max: number
  /** Describes what is being measured, for screen readers. */
  label: string
  /** Sits on dark chrome — track and fill invert. */
  onDark?: boolean
  /** Delays the grow-in so stacked bars do not all fire at once. */
  delayMs?: number
  className?: string
}

export function ProgressBar({
  value,
  max,
  label,
  onDark = false,
  delayMs = 240,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const percent = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)))

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full',
        onDark ? 'bg-white/16' : 'bg-accent-100',
        className,
      )}
    >
      <div
        className={cn(
          'animate-grow-x h-full rounded-full',
          onDark ? 'bg-white' : 'bg-accent-600',
        )}
        style={{ width: `${percent}%`, animationDelay: `${delayMs}ms` }}
      />
    </div>
  )
}
