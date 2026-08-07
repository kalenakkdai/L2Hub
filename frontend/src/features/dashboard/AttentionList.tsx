import { Circle, CircleDashed, Clock, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn } from '../../components/ui/cn'
import type { AttentionItem } from './types'

/** The left border band carries urgency without adding another badge. */
const URGENCY_BORDER: Record<AttentionItem['urgency'], string> = {
  high: 'border-l-accent-600',
  overdue: 'border-l-status-danger',
  normal: 'border-l-border-dotted',
}

const STATUS_ICON: Record<string, LucideIcon> = {
  warning: Clock,
  danger: TriangleAlert,
  neutral: CircleDashed,
  accent: Circle,
  info: Circle,
}

/**
 * What needs doing, most urgent first. The ordering is the server's, not the
 * UI's — this component ranks nothing, it only renders the given order.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-l-[3px] border-border-subtle bg-surface px-5 py-4 shadow-card transition duration-[420ms] ease-out-quick hover:-translate-y-[3px] hover:border-accent-200 hover:shadow-card-hover hover:duration-[260ms]',
            URGENCY_BORDER[item.urgency],
          )}
        >
          <span aria-hidden="true" className="w-4 shrink-0 font-mono text-xs text-ink-faint">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2.5">
              <span className="font-semibold tracking-[-0.008em] text-ink">{item.title}</span>
              <StatusBadge tone={item.status.tone} icon={STATUS_ICON[item.status.tone]}>
                {item.status.label}
              </StatusBadge>
            </div>
            <p className="text-[13.5px] text-ink-subtle">{item.meta}</p>
          </div>

          {item.progress && (
            <ProgressBar
              className="h-[5px] w-30 shrink-0"
              value={item.progress.value}
              max={item.progress.max}
              delayMs={300}
              label={`${item.title}: ${item.progress.value} of ${item.progress.max} complete`}
            />
          )}

          <ButtonLink
            to={item.action.to}
            size="sm"
            variant={item.action.emphasis === 'primary' ? 'primary' : 'secondary'}
            className="shrink-0"
          >
            {item.action.label}
          </ButtonLink>
        </li>
      ))}
    </ol>
  )
}
