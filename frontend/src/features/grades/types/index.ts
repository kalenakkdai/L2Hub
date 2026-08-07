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
  | 'gradebook.mark_excused'
  | 'debrief.reopen'

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
  isLate?: boolean
  canSubmit?: boolean
  canResubmit?: boolean
  acceptingLateSubmissions?: boolean
}

export interface GradebookSummary {
  completed?: number
  missing?: number
  open?: number
  earnedPoints?: number
  possiblePoints?: number
  completionPercent?: number
}

export interface GradebookOverview {
  entries: GradebookEntry[]
  summary: GradebookSummary
  student?: {
    id: string
    name: string
    committee?: GradeCommitteeRef | null
  } | null
}

export interface GradebookFilters {
  status?: GradeStatus | 'all' | 'open' | 'upcoming'
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
}

export type GradebookSortField =
  | 'dueAt'
  | 'newest'
  | 'oldest'
  | 'title'
  | 'status'
  | 'score'
  | 'default'
