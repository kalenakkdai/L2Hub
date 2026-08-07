import type { GradeStatus } from '../types'

export function statusLabel(status: GradeStatus): string {
  switch (status) {
    case 'not_started':
      return 'Not started'
    case 'draft':
      return 'Draft'
    case 'submitted':
      return 'Submitted'
    case 'late':
      return 'Late'
    case 'graded':
      return 'Graded'
    case 'missing':
      return 'Missing'
    case 'excused':
      return 'Excused'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}
