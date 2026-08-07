/**
 * The shape `GET /dashboard/modules` is expected to return.
 *
 * Written before the endpoint exists so the UI is built against the contract
 * rather than against the fixture. When the real endpoint lands, only
 * useDashboard.ts changes.
 */

/** Groups the dashboard renders, in display order. */
export type ModuleGroupKey = 'my_work' | 'committee' | 'events' | 'leadership'

export type DashboardModule = {
  id: string
  group: ModuleGroupKey
  title: string
  description: string
  /** Lucide icon name, resolved to a component by the card. */
  icon: string
  to: string
  /** Optional count, e.g. 3 open tasks. */
  count?: number
  badge?: {
    label: string
    tone: 'accent' | 'warning' | 'danger' | 'info' | 'neutral'
  }
}

export type FeaturedItem = {
  kind: 'event' | 'debrief'
  title: string
  summary: string
  /** ISO 8601. Rendered relative to now. */
  startsAt: string
  location: string
  /** e.g. "Attending", "Response needed". */
  status: { label: string; tone: 'accent' | 'warning' | 'info' | 'neutral' }
  actionLabel: string
  to: string
}

export type ProgressSummary = {
  level: number
  levelTitle: string
  points: number
  pointsToNextLevel: number
  eventsAttended: number
  eventsPossible: number
  /** Percentage 0-100. */
  participationRate: number
}

export type ActivityItem = {
  id: string
  /** Drives the icon and tone. */
  kind: 'points' | 'event' | 'submission' | 'committee' | 'level'
  description: string
  /** ISO 8601. */
  occurredAt: string
}

export type DashboardData = {
  /** Not yet on the profiles table — see the fixture note. */
  committee: string | null
  featured: FeaturedItem | null
  progress: ProgressSummary
  modules: DashboardModule[]
  activity: ActivityItem[]
}
