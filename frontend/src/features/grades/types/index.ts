/**
 * Domain types for the L2 Hub Grades feature.
 * Backend / adapters own grading policy; the UI only displays authoritative data.
 */

export type GradeStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'late'
  | 'graded'
  | 'missing'
  | 'excused'
  | 'closed'

export type AssignmentType =
  | 'event_debrief'
  | 'reflection'
  | 'attendance'
  | 'task'
  | 'committee_deliverable'
  | 'meeting_response'
  | 'material_checklist'
  | 'custom'

export type GradebookPermission =
  | 'gradebook.view_own'
  | 'gradebook.view_event'
  | 'gradebook.view_student'
  | 'gradebook.edit'
  | 'gradebook.assign'
  | 'gradebook.grade'
  | 'gradebook.publish'
  | 'gradebook.mark_excused'
  | 'debrief.reopen'

/** Maps backend `grades.*` keys onto the Grades UI permission namespace. */
export function mapBackendGradePermissions(
  permissions: readonly string[],
): GradebookPermission[] {
  const set = new Set(permissions)
  const mapped: GradebookPermission[] = []
  if (set.has('grades.view_own')) mapped.push('gradebook.view_own')
  if (set.has('grades.view_committee') || set.has('grades.view_all')) {
    mapped.push('gradebook.view_event', 'gradebook.view_student')
  }
  if (set.has('grades.assign')) mapped.push('gradebook.assign')
  if (set.has('grades.grade_committee')) {
    mapped.push('gradebook.grade', 'gradebook.mark_excused')
  }
  if (set.has('grades.publish')) mapped.push('gradebook.publish')
  if (set.has('debrief.reopen')) mapped.push('debrief.reopen')
  return mapped
}

export type GradePublicationStatus = 'draft' | 'pending_publish' | 'published'

export type SubmissionHistoryType =
  | 'draft_created'
  | 'draft_saved'
  | 'submitted'
  | 'reopened'
  | 'resubmitted'
  | 'graded'
  | 'excused'

export interface GradeEventRef {
  id: string
  name: string
}

export interface GradeCommitteeRef {
  id: string
  name: string
}

/** Tabs that bucket assignment rows. */
export type AssignmentGradebookTab = 'missing' | 'completed' | 'upcoming'

/** Grades page tabs, including the syllabus reference panel. */
export type GradebookTab = AssignmentGradebookTab | 'syllabus'

/**
 * Anonymized class distribution for one assignment.
 * Never includes student names or ids — only aggregate stats / percents.
 */
export interface GradeDistributionBucket {
  label: string
  count: number
  minPercent: number
  maxPercent: number
}

export interface GradeDistribution {
  /** Optional provider-authored mean percentage (0–100). */
  mean?: number | null
  /** Optional provider-authored median percentage (0–100). */
  median?: number | null
  scoredCount?: number
  /** Anonymized score percentages used when mean/median/buckets are omitted. */
  scorePercents?: number[]
  buckets?: GradeDistributionBucket[]
  /** Viewer's own percentage, when the provider chooses to expose it. */
  yourPercent?: number | null
}

export interface GradebookEntry {
  id: string
  assignmentId: string
  assignmentTitle: string
  assignmentType: AssignmentType
  event?: GradeEventRef | null
  committee?: GradeCommitteeRef | null
  status: GradeStatus
  score: number | null
  pointsPossible: number | null
  availableAt?: string | null
  dueAt?: string | null
  lateDueAt?: string | null
  closedAt?: string | null
  submittedAt?: string | null
  gradedAt?: string | null
  /** When heads score work, it waits here until Jan publishes. */
  publicationStatus?: GradePublicationStatus | null
  publishedAt?: string | null
  isLate?: boolean
  canSubmit?: boolean
  canResubmit?: boolean
  acceptingLateSubmissions?: boolean
  /** Class distribution when the provider has released anonymized stats. */
  distribution?: GradeDistribution | null
  /** Canvas-style assignment group / category. */
  categoryId?: string | null
}

/**
 * Assignment group weights, Canvas-style.
 * Within a category grades are points/possible; categories combine by weight.
 */
export interface GradeCategory {
  id: string
  name: string
  /** Share of the final grade, e.g. 40 for 40%. Ideally sums to 100. */
  weightPercent: number
}

export interface CategoryGradeSummary {
  categoryId: string
  name: string
  weightPercent: number
  earnedPoints: number
  possiblePoints: number
  /** Category percent from its own point total; null if nothing countable yet. */
  percent: number | null
  /** Contribution toward the renormalized weighted final. */
  weightedContribution: number | null
  assignmentCount: number
  scoredCount: number
}

export interface GradebookSummary {
  completed?: number
  missing?: number
  open?: number
  earnedPoints?: number
  possiblePoints?: number
  completionPercent?: number
  /** Canvas-style weighted total (0–100). */
  weightedPercent?: number
  categoryBreakdown?: CategoryGradeSummary[]
}

export interface GradebookOverview {
  entries: GradebookEntry[]
  summary: GradebookSummary
  /** Assignment groups for weighted grading. Empty/omitted = points-only. */
  categories?: GradeCategory[]
  student?: {
    id: string
    name: string
    committee?: GradeCommitteeRef | null
  } | null
}

export interface GradebookFilters {
  status?: GradeStatus | 'all' | 'open' | 'upcoming' | 'completed' | 'missing'
  eventId?: string
  assignmentType?: AssignmentType
  committeeId?: string
  query?: string
}

export interface GradeFeedbackItem {
  id: string
  label: string
  passed?: boolean
  pointsEarned?: number | null
  pointsPossible?: number | null
  note?: string | null
}

export interface GradeFeedback {
  summary?: string | null
  items?: GradeFeedbackItem[]
  kind?: 'completion_criteria' | 'requirements' | 'submission_checks' | 'officer_feedback' | 'adviser_feedback'
}

/** Manual parts are scored by an assigner; on_time is computed from due/submit times. */
export type RubricCriterionKind = 'manual' | 'on_time'

export interface RubricCriterion {
  id: string
  label: string
  description?: string | null
  pointsPossible: number
  kind: RubricCriterionKind
  /**
   * Percent of the assignment total deducted per calendar day late.
   * Only used when kind === 'on_time'. Default policy is 10.
   */
  latePenaltyPercentPerDay?: number
  /** Default criteria (like On time) cannot be removed from an assignment. */
  isDefault?: boolean
}

export interface AssignmentRubric {
  criteria: RubricCriterion[]
}

export interface RubricCriterionScore {
  criterionId: string
  /** Null means not yet scored. */
  pointsEarned: number | null
  note?: string | null
  lateDays?: number | null
  autoApplied?: boolean
}

export interface RubricEvaluation {
  scores: RubricCriterionScore[]
  /** Sum of manual criterion points earned (null if any required part unscored). */
  contentEarned: number | null
  contentPossible: number
  lateDays: number
  latePenaltyPoints: number
  /** Final points after the automatic on-time deduction. */
  earnedPoints: number | null
  possiblePoints: number
}

export interface MaterialRequest {
  id: string
  name: string
  quantity?: number | null
  reason?: string | null
  purchasingUrl?: string | null
}

export interface CommitteeRating {
  committeeId: string
  committeeName: string
  rating: number | null
  maxRating?: number
}

export interface EventDebriefSubmissionContent {
  overallRating: number | null
  overallMaxRating?: number
  committeeRatings: CommitteeRating[]
  strengths: string[]
  improvements: string[]
  materialRequests: MaterialRequest[]
  /** Present only when policy allows the viewer to see their own text. */
  anonymousConcernVisibleText?: string | null
  hasAnonymousConcern?: boolean
}

export interface ReflectionSubmissionContent {
  prompt?: string | null
  body: string
}

export interface GenericSubmissionContent {
  title?: string | null
  body?: string | null
  checklist?: Array<{ id: string; label: string; completed: boolean }>
}

export type GradeSubmissionContent =
  | { type: 'event_debrief'; data: EventDebriefSubmissionContent }
  | { type: 'reflection'; data: ReflectionSubmissionContent }
  | { type: 'generic'; data: GenericSubmissionContent }

export interface GradeSubmission {
  id: string
  assignmentId: string
  submittedAt: string | null
  isLate: boolean
  attempt: number
  content: GradeSubmissionContent | null
}

export interface SubmissionHistoryItem {
  id: string
  type: SubmissionHistoryType
  occurredAt: string
  label: string
  description?: string | null
}

export interface GradeAssignmentDetail {
  entry: GradebookEntry
  submission: GradeSubmission | null
  feedback: GradeFeedback | null
  /** Rubric definition — always includes the default On time criterion. */
  rubric: AssignmentRubric
  /** Graded / auto-computed breakdown; null when nothing has been scored yet. */
  rubricEvaluation: RubricEvaluation | null
  student?: {
    id: string
    name: string
    committee?: GradeCommitteeRef | null
  } | null
}

export interface EventGradebookStudentRow {
  studentId: string
  studentName: string
  committee?: GradeCommitteeRef | null
  status: GradeStatus
  score: number | null
  pointsPossible: number | null
  entryId: string
  assignmentId: string
  isAbsent?: boolean
}

export interface EventGradebook {
  event: GradeEventRef
  assignmentTitle: string
  assignmentId: string
  completionCompleted: number
  completionTotal: number
  rows: EventGradebookStudentRow[]
}

export interface StudentGradebook {
  student: {
    id: string
    name: string
    committee?: GradeCommitteeRef | null
  }
  overview: GradebookOverview
}

export interface GradeUpdateInput {
  score?: number | null
  status?: GradeStatus
  feedbackSummary?: string | null
  /** Assigner scores for manual rubric parts. On-time is never client-authored. */
  rubricScores?: RubricCriterionScore[]
}

export type GradebookSortField =
  | 'dueAt'
  | 'newest'
  | 'oldest'
  | 'title'
  | 'status'
  | 'score'
  | 'default'

/** A saved Canvas-style what-if / theoretical grade scenario. */
export interface TheoreticalGradeScenario {
  id: string
  name: string
  /** entry.id → hypothetical points earned. */
  scores: Record<string, number>
  weightedPercent: number | null
  savedAt: string
}
