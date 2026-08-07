/**
 * The shape `GET /dashboard` is expected to return.
 *
 * Written before the endpoint exists so the UI is built against the contract
 * rather than against the fixture. When the real endpoint lands, only
 * useDashboard.ts changes.
 */

export type BadgeTone = 'accent' | 'warning' | 'danger' | 'info' | 'neutral'

/** The three figures in the page header. */
export type HeaderStats = {
  points: number
  level: number
  openCount: number
}

export type PrepItem = {
  id: string
  label: string
  done: boolean
}

export type NextEvent = {
  id: string
  title: string
  /** ISO 8601. The countdown is derived, never sent. */
  startsAt: string
  /** Human window, e.g. "8:00 AM – 1:30 PM". */
  window: string
  location: string
  /** What this camper is doing at the event. */
  assignment: { title: string; detail: string }
  prep: PrepItem[]
  to: string
}

export type CalendarDay = {
  /** ISO date. */
  date: string
  /** Set when something is scheduled; absent means a quiet day. */
  title?: string
  detail?: string
  isToday?: boolean
}

export type AttentionItem = {
  id: string
  title: string
  meta: string
  status: { label: string; tone: BadgeTone }
  /** Left border colour band — how urgent this is. */
  urgency: 'high' | 'overdue' | 'normal'
  progress?: { value: number; max: number }
  action: { label: string; to: string; emphasis: 'primary' | 'secondary' }
}

export type GradeRow = {
  id: string
  assignment: string
  event: string | null
  status: { label: string; tone: BadgeTone }
  /** Null until the work is graded. */
  earned: number | null
  possible: number
  /** Which colour band the score falls in, or null when ungraded. */
  band: 'a-plus' | 'a' | 'a-minus' | 'bc' | 'below-c' | null
}

export type GradesOverview = {
  completed: number
  missing: number
  open: number
  pointsEarned: number
  pointsPossible: number
  rows: GradeRow[]
}

export type ProgressSummary = {
  level: number
  levelTitle: string
  points: number
  pointsToNextLevel: number
  streakWeeks: number
  tasksDone: number
  participationRate: number
  /** A line of encouragement derived from the numbers. */
  note: string | null
}

export type ActivityItem = {
  id: string
  kind: 'points' | 'event' | 'submission' | 'committee' | 'level'
  description: string
  /** Points awarded, when the entry is an award. */
  points?: number
  /** ISO 8601. */
  occurredAt: string
}

export type CommitteeSnapshot = {
  name: string
  status: string
  readinessPct: number
  actionItemCount: number
  to: string
}

export type LiveDebrief = {
  title: string
  session: string
  submitted: number
  writing: number
  notStarted: number
  absent: number
  to: string
}

export type UpcomingItem = {
  id: string
  /** ISO 8601. */
  startsAt: string
  title: string
}

export type DashboardData = {
  /** Not yet on the profiles table — see the fixture note. */
  committee: string | null
  campsiteCount: number
  stats: HeaderStats
  nextEvent: NextEvent | null
  calendar: CalendarDay[]
  attention: AttentionItem[]
  grades: GradesOverview
  progress: ProgressSummary
  activity: ActivityItem[]
  committeeSnapshot: CommitteeSnapshot | null
  liveDebrief: LiveDebrief | null
  upcoming: UpcomingItem[]
}
