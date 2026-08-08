import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * Tones deliberately exclude a separate green: "complete" uses the accent, so
 * green always means the same thing across the product.
 */
export type BadgeTone = 'accent' | 'warning' | 'danger' | 'info' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent-100 text-accent-ink border-accent-200',
  warning: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  danger: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  info: 'bg-status-info-bg text-status-info border-status-info-border',
  neutral: 'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
}

type StatusBadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  icon?: LucideIcon
  className?: string
}

export function StatusBadge({
  children,
  tone = 'neutral',
  icon: Icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  )
}
