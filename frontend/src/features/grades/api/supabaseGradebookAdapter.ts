import type {
  GradebookDataProvider,
  InjectedSupabaseClient,
  SupabaseGradebookConfig,
} from './contracts'
import type {
  AssignmentType,
  GradeAssignmentDetail,
  GradebookEntry,
  GradebookFilters,
  GradebookOverview,
  GradeStatus,
  GradeSubmission,
  SubmissionHistoryItem,
} from '../types'

type JsonRecord = Record<string, unknown>

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * Maps snake_case Supabase rows → camelCase GradebookEntry.
 * Kept inside the adapter so UI never sees database field names.
 */
export function mapSupabaseGradeEntry(row: JsonRecord): GradebookEntry {
  const eventId = asString(row.event_id)
  const eventName = asString(row.event_name)
  return {
    id: asString(row.id) ?? '',
    assignmentId: asString(row.assignment_id) ?? '',
    assignmentTitle: asString(row.assignment_title) ?? 'Untitled assignment',
    assignmentType: (asString(row.assignment_type) as AssignmentType) ?? 'custom',
    event:
      eventId && eventName
        ? { id: eventId, name: eventName }
        : null,
    status: (asString(row.status) as GradeStatus) ?? 'not_started',
    score: asNumber(row.score),
    pointsPossible: asNumber(row.points_possible),
    availableAt: asString(row.available_at),
    dueAt: asString(row.due_at),
    lateDueAt: asString(row.late_due_at),
    closedAt: asString(row.closed_at),
    submittedAt: asString(row.submitted_at),
    gradedAt: asString(row.graded_at),
    isLate: asBoolean(row.is_late),
    canSubmit: asBoolean(row.can_submit),
    canResubmit: asBoolean(row.can_resubmit),
    acceptingLateSubmissions: asBoolean(row.accepting_late_submissions),
  }
}

export function mapSupabaseHistoryItem(row: JsonRecord): SubmissionHistoryItem {
  return {
    id: asString(row.id) ?? '',
    type: (asString(row.type) as SubmissionHistoryItem['type']) ?? 'submitted',
    occurredAt: asString(row.occurred_at) ?? '',
    label: asString(row.label) ?? 'Event',
    description: asString(row.description),
  }
}

const DEFAULT_CONFIG: Required<SupabaseGradebookConfig> = {
  assignmentsTable: 'assignments',
  gradeEntriesTable: 'gradebook_entries',
  submissionsTable: 'submissions',
  eventsTable: 'events',
  profilesTable: 'profiles',
  historyTable: 'submission_history',
}

/**
 * OPTIONAL adapter. Inject an existing Supabase client — do not create one here.
 *
 * Schema names are configurable because collaborator tables may differ.
 * This adapter is a mapping boundary, not a migration tool.
 */
export class SupabaseGradebookDataProvider implements GradebookDataProvider {
  private client: InjectedSupabaseClient
  private config: Required<SupabaseGradebookConfig>

  constructor(
    client: InjectedSupabaseClient,
    config: SupabaseGradebookConfig = {},
  ) {
    this.client = client
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async getMyGradebook(filters?: GradebookFilters): Promise<GradebookOverview> {
    const result = await this.client
      .from(this.config.gradeEntriesTable)
      .select('*')

    if (result.error) {
      throw new Error(result.error.message)
    }

    let entries = (result.data ?? []).map((row) =>
      mapSupabaseGradeEntry(row as JsonRecord),
    )

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'open') {
        entries = entries.filter(
          (e) => e.status === 'not_started' || e.status === 'draft',
        )
      } else if (filters.status === 'upcoming') {
        entries = entries.filter(
          (e) => e.status === 'not_started' || e.status === 'draft',
        )
      } else {
        entries = entries.filter((e) => e.status === filters.status)
      }
    }

    if (filters?.query) {
      const q = filters.query.toLowerCase()
      entries = entries.filter((e) =>
        `${e.assignmentTitle} ${e.event?.name ?? ''} ${e.assignmentType}`
          .toLowerCase()
          .includes(q),
      )
    }

    const earnedPoints = entries.reduce(
      (sum, e) => sum + (e.score ?? 0),
      0,
    )
    const possiblePoints = entries.reduce(
      (sum, e) => sum + (e.pointsPossible ?? 0),
      0,
    )

    return {
      entries,
      summary: {
        completed: entries.filter((e) =>
          ['graded', 'submitted', 'late', 'excused'].includes(e.status),
        ).length,
        missing: entries.filter((e) => e.status === 'missing').length,
        open: entries.filter(
          (e) => e.status === 'not_started' || e.status === 'draft',
        ).length,
        earnedPoints,
        possiblePoints,
        completionPercent:
          possiblePoints > 0
            ? Math.round((earnedPoints / possiblePoints) * 1000) / 10
            : undefined,
      },
    }
  }

  async getAssignment(assignmentId: string): Promise<GradeAssignmentDetail> {
    const result = await this.client
      .from(this.config.gradeEntriesTable)
      .select('*')
      .eq('assignment_id', assignmentId)

    if (result.error) throw new Error(result.error.message)
    const row = (result.data ?? [])[0] as JsonRecord | undefined
    if (!row) throw new Error('Assignment not found')

    const entry = mapSupabaseGradeEntry(row)
    const submission = await this.getMySubmission(assignmentId)

    return {
      entry,
      submission,
      feedback: null,
      student: null,
    }
  }

  async getSubmissionHistory(
    assignmentId: string,
  ): Promise<SubmissionHistoryItem[]> {
    const result = await this.client
      .from(this.config.historyTable)
      .select('*')
      .eq('assignment_id', assignmentId)

    if (result.error) throw new Error(result.error.message)
    return (result.data ?? []).map((row) =>
      mapSupabaseHistoryItem(row as JsonRecord),
    )
  }

  async getMySubmission(assignmentId: string): Promise<GradeSubmission | null> {
    const result = await this.client
      .from(this.config.submissionsTable)
      .select('*')
      .eq('assignment_id', assignmentId)

    if (result.error) throw new Error(result.error.message)
    const row = (result.data ?? [])[0] as JsonRecord | undefined
    if (!row) return null

    return {
      id: asString(row.id) ?? '',
      assignmentId,
      submittedAt: asString(row.submitted_at),
      isLate: asBoolean(row.is_late) ?? false,
      attempt: asNumber(row.attempt) ?? 1,
      content: null,
    }
  }
}
