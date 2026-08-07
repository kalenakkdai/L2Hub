import { apiFetch } from '../../api/client'

export type SummaryStatus =
  | 'not_requested'
  | 'pending_approval'
  | 'generating'
  | 'generated'
  | 'published'
  | 'archived'

export type EventListItem = {
  id: string
  name: string
  slug: string
  year: number
  eventStatus: string
  summaryStatus: SummaryStatus
  managingCommitteeId: string | null
  canRequest?: boolean
  canApprove?: boolean
  canGenerate?: boolean
  canPublish?: boolean
}

export type GenerationStatus = {
  status: SummaryStatus
  stage: string | null
  label: string | null
  stages: Array<{ key: string; label: string; done: boolean }>
}

export type WrappedPayload = {
  event: EventListItem
  status: SummaryStatus
  wrapped: Record<string, unknown>
  graph: {
    nodes: Array<{ id: string; label: string; mentions: number; kind: string }>
    edges: Array<{ source: string; target: string }>
    themes: Array<{
      id: string
      label: string
      mentions: number
      kind: string
      summary: string
      recommendedAction?: string | null
      positivePatterns?: string | null
      improvementPatterns?: string | null
      relatedThemeIds?: string[]
      contributors: Array<{
        name: string | null
        committee: string | null
        quote: string
        anonymous: boolean
      }>
    }>
  }
  executiveSummary: Record<string, unknown>
}

export type LiveParticipant = {
  id: string
  displayName: string
  status: 'not_started' | 'writing' | 'submitted' | 'absent' | string
  submittedAt: string | null
}

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  payload: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export function fetchEvents() {
  return apiFetch<{ events: EventListItem[] }>('/events')
}

export function fetchEvent(eventRef: string) {
  return apiFetch<EventListItem>(`/events/${eventRef}`)
}

export function requestSummary(eventRef: string, note?: string) {
  return apiFetch<{ id: string; status: string; summaryStatus: string }>(
    `/events/${eventRef}/summary/request`,
    { method: 'POST', body: JSON.stringify({ note: note ?? null }) },
  )
}

export function approveSummary(eventRef: string) {
  return apiFetch<GenerationStatus>(`/events/${eventRef}/summary/approve`, {
    method: 'POST',
  })
}

export function rejectSummary(eventRef: string, note?: string) {
  return apiFetch<{ status: string }>(`/events/${eventRef}/summary/reject`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? null }),
  })
}

export function generateSummary(eventRef: string) {
  return apiFetch<GenerationStatus>(`/events/${eventRef}/summary/generate`, {
    method: 'POST',
  })
}

export function fetchSummaryStatus(eventRef: string) {
  return apiFetch<GenerationStatus>(`/events/${eventRef}/summary/status`)
}

export function publishSummary(eventRef: string) {
  return apiFetch<{ status: string }>(`/events/${eventRef}/summary/publish`, {
    method: 'POST',
  })
}

export function fetchWrapped(eventRef: string) {
  return apiFetch<WrappedPayload>(`/events/${eventRef}/wrapped`)
}

export function fetchAgenda(eventRef: string) {
  return apiFetch<{ id: string; status: string; content: Record<string, unknown> }>(
    `/events/${eventRef}/agenda`,
  )
}

export function generateAgenda(eventRef: string) {
  return apiFetch<{ id: string; status: string; content: Record<string, unknown> }>(
    `/events/${eventRef}/agenda/generate`,
    { method: 'POST' },
  )
}

export function fetchLiveParticipants(eventRef: string) {
  return apiFetch<{ eventId: string; participants: LiveParticipant[] }>(
    `/events/${eventRef}/live`,
  )
}

export function fetchNotifications() {
  return apiFetch<{ notifications: AppNotification[] }>('/notifications')
}

export function summaryStatusLabel(status: SummaryStatus | string): string {
  switch (status) {
    case 'not_requested':
      return 'Not Requested'
    case 'pending_approval':
      return 'Pending Approval'
    case 'generating':
      return 'Generating'
    case 'generated':
      return 'Wrapped Ready'
    case 'published':
      return 'Published'
    case 'archived':
      return 'Archived'
    default:
      return status
  }
}
