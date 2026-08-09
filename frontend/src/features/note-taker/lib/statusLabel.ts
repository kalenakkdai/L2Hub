import type { MeetingSessionStatus } from '../types'

export function statusLabel(status: MeetingSessionStatus | string): string {
  switch (status) {
    case 'ready':
      return 'Ready'
    case 'processing':
      return 'Drafting notes…'
    case 'uploading':
      return 'Uploading…'
    case 'failed':
      return 'Failed'
    default:
      return 'Recording'
  }
}

/** Badge classes for the light-surface list page. */
export function statusTone(status: MeetingSessionStatus | string): string {
  switch (status) {
    case 'ready':
      return 'bg-accent-50 text-accent-700'
    case 'processing':
    case 'uploading':
      return 'bg-status-warning-bg text-status-warning'
    case 'failed':
      return 'bg-status-danger-bg text-status-danger'
    default:
      return 'bg-surface-sunken text-ink-muted'
  }
}
