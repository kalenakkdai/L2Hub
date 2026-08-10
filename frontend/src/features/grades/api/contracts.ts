import type {
  EventGradebook,
  GradeAssignmentDetail,
  GradebookEntry,
  GradebookFilters,
  GradebookOverview,
  GradebookPermission,
  GradeSubmission,
  GradeUpdateInput,
  StudentGradebook,
  SubmissionHistoryItem,
} from '../types'

/**
 * Read API for Grades UI. Pages talk ONLY to this interface.
 */
export interface GradebookDataProvider {
  getMyGradebook(filters?: GradebookFilters): Promise<GradebookOverview>
  getAssignment(assignmentId: string): Promise<GradeAssignmentDetail>
  getSubmissionHistory(assignmentId: string): Promise<SubmissionHistoryItem[]>
  getMySubmission(assignmentId: string): Promise<GradeSubmission | null>
  getEventGradebook?(eventId: string): Promise<EventGradebook>
  getStudentGradebook?(studentId: string): Promise<StudentGradebook>
}

/**
 * Optional write API. UI shows controls only when methods + permissions exist.
 */
export interface GradebookCommandProvider {
  updateGrade?(
    entryId: string,
    input: GradeUpdateInput,
  ): Promise<GradebookEntry>
  markExcused?(entryId: string): Promise<GradebookEntry>
  reopenSubmission?(assignmentId: string, studentId: string): Promise<void>
  /** Jan releases head-entered scores to students. */
  publishGrades?(entryIds: string[]): Promise<GradebookEntry[]>
}

/**
 * Permission / identity surface for Grades UX.
 * Backend / RLS remain authoritative; this is for rendering only.
 */
export interface GradebookAuthProvider {
  getCurrentUser(): Promise<{
    id: string
    name: string
    committeeName?: string | null
  } | null>
  hasPermission(permission: GradebookPermission): boolean
  getPermissions(): GradebookPermission[]
}

/**
 * Minimal Supabase-like client shape so the adapter never creates its own client.
 * Inject the host app's existing client at the composition root.
 */
export interface InjectedSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => PromiseLike<{
      data: unknown[] | null
      error: { message: string } | null
    }> & {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{
        data: unknown[] | null
        error: { message: string } | null
      }> & {
        maybeSingle?: () => PromiseLike<{
          data: unknown | null
          error: { message: string } | null
        }>
        order?: (
          column: string,
          options?: { ascending?: boolean },
        ) => PromiseLike<{
          data: unknown[] | null
          error: { message: string } | null
        }>
      }
      order?: (
        column: string,
        options?: { ascending?: boolean },
      ) => PromiseLike<{
        data: unknown[] | null
        error: { message: string } | null
      }>
    }
  }
}

export interface SupabaseGradebookConfig {
  assignmentsTable?: string
  gradeEntriesTable?: string
  submissionsTable?: string
  eventsTable?: string
  profilesTable?: string
  historyTable?: string
}
