import type { GradeStatus, GradebookEntry, GradebookSortField } from '../types'

export function formatScore(
  score: number | null | undefined,
  pointsPossible: number | null | undefined,
): string {
  if (score === null || score === undefined) {
    if (pointsPossible === null || pointsPossible === undefined) return '—'
    return `— / ${pointsPossible}`
  }
  if (pointsPossible === null || pointsPossible === undefined) {
    return String(score)
  }
  return `${score} / ${pointsPossible}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTimeLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function statusSortRank(status: GradeStatus): number {
  const order: Record<GradeStatus, number> = {
    missing: 0,
    draft: 1,
    not_started: 2,
    late: 3,
    submitted: 4,
    graded: 5,
    excused: 6,
    closed: 7,
  }
  return order[status]
}

/**
 * Default ordering: open/actionable first, then by soonest due date.
 */
export function sortGradebookEntries(
  entries: GradebookEntry[],
  sort: GradebookSortField = 'default',
): GradebookEntry[] {
  const copy = [...entries]
  copy.sort((a, b) => {
    switch (sort) {
      case 'title':
        return a.assignmentTitle.localeCompare(b.assignmentTitle)
      case 'status':
        return statusSortRank(a.status) - statusSortRank(b.status)
      case 'score': {
        const as = a.score ?? -1
        const bs = b.score ?? -1
        return bs - as
      }
      case 'newest':
        return (b.dueAt ?? '').localeCompare(a.dueAt ?? '')
      case 'oldest':
        return (a.dueAt ?? '').localeCompare(b.dueAt ?? '')
      case 'dueAt':
        return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
      case 'default':
      default: {
        const aOpen = a.status === 'not_started' || a.status === 'draft' || a.status === 'missing'
        const bOpen = b.status === 'not_started' || b.status === 'draft' || b.status === 'missing'
        if (aOpen !== bOpen) return aOpen ? -1 : 1
        return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
      }
    }
  })
  return copy
}

export function availableSubmittedLabel(entry: GradebookEntry): string {
  if (entry.submittedAt) {
    const lateSuffix = entry.isLate ? ' (late)' : ''
    return `Submitted ${formatDateTime(entry.submittedAt)}${lateSuffix}`
  }
  if (entry.status === 'draft') return 'Draft in progress'
  if (entry.status === 'not_started') return 'Open'
  if (entry.status === 'missing') return 'Not submitted'
  if (entry.status === 'excused') return 'Excused'
  if (entry.status === 'closed') return 'Closed'
  return '—'
}
