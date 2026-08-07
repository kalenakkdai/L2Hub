import { cn } from './cn'

type ProgressBarProps = {
  value: number
  max: number
  /** Describes what is being measured, for screen readers. */
  label: string
  className?: string
}

export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const percent = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)))

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-status-neutral-bg', className)}
    >
      <div
        className="h-full rounded-full bg-accent-600 transition-[width] duration-500 ease-out-quick"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
