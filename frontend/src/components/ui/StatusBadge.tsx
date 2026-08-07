import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * Tones deliberately exclude a separate green: "complete" uses the accent, so
 * green always means the same thing across the product.
 */
export type BadgeTone = 'accent' | 'warning' | 'danger' | 'info' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent-50 text-accent-700',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-status-neutral-bg text-status-neutral',
}

type StatusBadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-label font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
