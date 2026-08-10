import type { PlanStatus } from '../types'

const LABELS: Record<PlanStatus, string> = {
  draft: 'Draft',
  pending_enablement: 'Awaiting enablement',
  enabled: 'Enabled',
  active: 'Active',
  completed: 'Completed',
}

const TONES: Record<PlanStatus, string> = {
  draft: 'bg-status-neutral-bg text-ink-muted',
  pending_enablement: 'bg-status-warning-bg text-status-warning',
  enabled: 'bg-accent-50 text-accent-ink',
  active: 'bg-status-info-bg text-status-info',
  completed: 'bg-status-neutral-bg text-ink-muted',
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={`rounded-control px-2 py-0.5 text-[11px] font-semibold ${TONES[status]}`}
    >
      {LABELS[status]}
    </span>
  )
}
