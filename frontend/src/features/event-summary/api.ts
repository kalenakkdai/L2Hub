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
  /** Scheduled window, when one has been set. Used to group the events list. */
  startsAt?: string | null
  endsAt?: string | null
  summaryStatus: SummaryStatus
  managingCommitteeId: string | null
  /** Set once the Wrapped has been walked through with the class. */
  wrappedPresentedAt: string | null
  canRequest?: boolean
  canApprove?: boolean
  canGenerate?: boolean
  canPublish?: boolean
  canPresent?: boolean
}

/** A theme headline. The recap never carries contributor quotes or names. */
export type RecapTheme = {
  id: string
  label: string
  mentions: number
  summary: string
}

export type WrappedRecap = {
  event: EventListItem
  presentedAt: string | null
  hero: {
    title: string
    tagline: string
    contributors: number
    submissionRate: number
  } | null
  overallRating: { score: number; max: number; stars?: number } | null
  participation: {
    invited: number
    submitted: number
    absent: number
    completionPercent: number
  } | null
  committeeRankings: Array<{ name: string; rating: number }>
  topStrengths: RecapTheme[]
  topImprovements: RecapTheme[]
  materialRequests: Array<{
    name: string
    requests: number
    quantity: number
    estimatedCost: number
    purchasingUrl?: string
  }>
  summary: string | null
  recommendedActions: string[]
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

/** Promote an approved Event Planning record into the Events catalog. */
export function promoteApprovedPlan(input: {
  planId: string
  title: string
  eventDate: string
}): Promise<EventListItem> {
  return apiFetch<EventListItem>('/events/from-plan', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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

/**
 * Records that the class has now been through this Wrapped. The server stamps
 * the time and keeps the first walkthrough, so repeat calls are harmless.
 */
export function markWrappedPresented(eventRef: string) {
  return apiFetch<{ status: string; presentedAt: string | null }>(
    `/events/${eventRef}/wrapped/presented`,
    { method: 'POST' },
  )
}

/** The condensed Wrapped shown when an event row is expanded. */
export function fetchWrappedRecap(eventRef: string) {
  return apiFetch<WrappedRecap>(`/events/${eventRef}/recap`)
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
  // `unread` is counted server-side rather than derived from the page of
  // notifications, which is capped at 50 and would undercount past that.
  return apiFetch<{ unread: number; notifications: AppNotification[] }>('/notifications')
}

export function markAllNotificationsRead() {
  return apiFetch<{ markedRead: number; unread: number }>('/notifications/read', {
    method: 'POST',
  })
}

export function markNotificationRead(notificationId: string) {
  return apiFetch<{ markedRead: number; unread: number }>(
    `/notifications/${notificationId}/read`,
    { method: 'POST' },
  )
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
