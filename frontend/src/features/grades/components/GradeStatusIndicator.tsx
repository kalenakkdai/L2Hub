import { Check, Circle, Clock, Lock, Minus } from 'lucide-react'
import type { GradeStatus } from '../types'
import { statusLabel } from '../utils/status'

const statusStyles: Record<
  GradeStatus,
  { text: string; icon: 'check' | 'circle' | 'clock' | 'lock' | 'minus'; filled: boolean }
> = {
  submitted: { text: 'text-emerald-700', icon: 'circle', filled: true },
  graded: { text: 'text-emerald-700', icon: 'check', filled: true },
  draft: { text: 'text-sky-700', icon: 'circle', filled: true },
  not_started: { text: 'text-slate-500', icon: 'circle', filled: false },
  late: { text: 'text-amber-700', icon: 'clock', filled: true },
  missing: { text: 'text-red-700', icon: 'circle', filled: true },
  excused: { text: 'text-slate-500', icon: 'minus', filled: true },
  closed: { text: 'text-slate-500', icon: 'lock', filled: true },
}

export interface GradeStatusIndicatorProps {
  status: GradeStatus
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Color + icon + text. Never communicates status by color alone.
 */
export function GradeStatusIndicator({
  status,
  className = '',
  size = 'sm',
}: GradeStatusIndicatorProps) {
  const style = statusStyles[status]
  const label = statusLabel(status)
  const iconSize = size === 'sm' ? 10 : 15

  let icon = (
    <Circle
      size={iconSize}
      className={style.filled ? 'fill-current' : ''}
      aria-hidden="true"
    />
  )
  if (style.icon === 'check') {
    icon = <Check size={iconSize} aria-hidden="true" strokeWidth={2.5} />
  } else if (style.icon === 'clock') {
    icon = <Clock size={iconSize} aria-hidden="true" />
  } else if (style.icon === 'lock') {
    icon = <Lock size={iconSize} aria-hidden="true" />
  } else if (style.icon === 'minus') {
    icon = <Minus size={iconSize} aria-hidden="true" />
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${style.text} ${className}`}
      data-status={status}
    >
      {icon}
      <span>{label}</span>
      <span className="sr-only">Status: {label}</span>
    </span>
  )
}
