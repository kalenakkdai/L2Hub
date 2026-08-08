import type { CheckpointStatus, FundraiserGoal, HomecomingPlan } from '../types'

/** Whole-number percent toward the fundraiser goal. */
export function fundraiserPercent(goal: Pick<FundraiserGoal, 'raisedCents' | 'targetCents'>): number {
  if (goal.targetCents <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((goal.raisedCents / goal.targetCents) * 100)))
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function homecomingCompletion(plan: Pick<HomecomingPlan, 'checkpoints'>): {
  done: number
  total: number
  percent: number
} {
  const total = plan.checkpoints.length
  const done = plan.checkpoints.filter((c) => c.status === 'done').length
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

export function checkpointTone(status: CheckpointStatus): string {
  switch (status) {
    case 'done':
      return 'text-status-success'
    case 'missed':
      return 'text-status-danger'
    default:
      return 'text-ink-muted'
  }
}
