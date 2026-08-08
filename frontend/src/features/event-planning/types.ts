/**
 * Event Planning domain types.
 * Enablement is AC-only (Mr. Jan). Anonymous reports never carry author identity.
 */

export type PlanStatus =
  | 'draft'
  | 'pending_enablement'
  | 'enabled'
  | 'active'
  | 'completed'

export type AssignmentTargetType = 'committee' | 'individual'

export type AssignmentStatus = 'invited' | 'accepted' | 'declined'

export type PlanningReportCategory =
  | 'inefficiency'
  | 'disruptive'
  | 'not_completing_on_time'
  | 'not_doing_work'
  | 'other'

export interface PlanningMember {
  id: string
  name: string
  committeeId?: string | null
  committeeName?: string | null
}

export interface PlanningCommittee {
  id: string
  name: string
}

export interface PlanAssignment {
  id: string
  targetType: AssignmentTargetType
  /** Set when targetType === 'committee'. */
  committeeId?: string | null
  committeeName?: string | null
  /** Set when targetType === 'individual'. */
  memberId?: string | null
  memberName?: string | null
  roleLabel: string
  status: AssignmentStatus
}

/**
 * Meeting agenda auto-generated when a plan is created.
 * Shape mirrors the Winter Ball planning agendas (Attendees /
 * To-do before meeting / Agenda & Meeting Notes).
 */
export interface PlanAgendaItem {
  letter?: string
  text: string
  subItems?: string[]
}

export interface PlanAgendaSection {
  roman: string
  title: string
  items: PlanAgendaItem[]
}

export interface PlanAgendaDocument {
  schoolName: string
  schoolYear: string
  title: string
  goals: string[]
  sections: PlanAgendaSection[]
  generatedAt: string
  /** Which historical document the shape was taken from. */
  templateSource: string
}

export interface EventPlan {
  id: string
  title: string
  summary: string
  eventDate?: string | null
  status: PlanStatus
  createdById: string
  createdByName: string
  createdAt: string
  enabledAt?: string | null
  enabledByName?: string | null
  assignments: PlanAssignment[]
  /** Always set on create — Winter Ball–style meeting agenda draft. */
  agenda: PlanAgendaDocument
}

export interface CreateEventPlanInput {
  title: string
  summary: string
  eventDate?: string | null
}

export interface AssignToPlanInput {
  targetType: AssignmentTargetType
  committeeId?: string | null
  memberId?: string | null
  roleLabel: string
}

/**
 * Evidence attached to an anonymous report (screenshot / file).
 * Filenames are sanitized server-side so original device names cannot
 * identify the author.
 */
export interface PlanningReportAttachment {
  id: string
  /** Safe display name only (e.g. screenshot-1.png). Never the original filename. */
  displayName: string
  mimeType: string
  sizeBytes: number
  /** Local MVP: data URL. Production would use an opaque storage URL. */
  dataUrl: string
}

/**
 * Redacted anonymous report — never includes author id, name, or email.
 * Even AC responses must use this shape for anonymous submissions.
 */
export interface PlanningReport {
  id: string
  planId: string
  /** Subject of the report (the member being reported), not the author. */
  subjectMemberId: string
  subjectMemberName: string
  category: PlanningReportCategory
  details: string
  attachments: PlanningReportAttachment[]
  createdAt: string
}

export interface SubmitPlanningReportInput {
  subjectMemberId: string
  category: PlanningReportCategory
  details: string
  attachments?: PlanningReportAttachment[]
}

export interface HistoricalEventHit {
  id: string
  name: string
  year: number
  summary: string
  themes: string[]
  score: number
}

export interface PlanningOutline {
  eventName: string
  year: number
  guideline: string
  sections: Array<{ title: string; bullets: string[] }>
}

export interface PlanningRagResult {
  query: string
  hits: HistoricalEventHit[]
  outline: PlanningOutline | null
}

export type PlanningPermission =
  | 'planning.view'
  | 'planning.create'
  | 'planning.assign'
  | 'planning.enable'
  | 'feedback.view_anonymous'
  | 'knowledge.view'
