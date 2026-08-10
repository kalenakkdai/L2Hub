import { apiFetch } from '../../../api/client'
import { fetchCurrentUser } from '../../../api/auth'
import type {
  GradebookCommandProvider,
  GradebookDataProvider,
  GradebookAuthProvider,
} from './contracts'
import type {
  AssignmentDraftRequest,
  BulkGradeItem,
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
import { mapBackendGradePermissions } from '../types'

type ApiOverview = {
  user_id?: string
  entries: GradebookEntry[]
  summary: GradebookOverview['summary']
  categories?: GradebookOverview['categories']
  student?: GradebookOverview['student']
  visibility?: string
}

function filterEntries(
  entries: GradebookEntry[],
  filters?: GradebookFilters,
): GradebookEntry[] {
  if (!filters?.query?.trim()) return entries
  const q = filters.query.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      entry.assignmentTitle.toLowerCase().includes(q) ||
      (entry.event?.name ?? '').toLowerCase().includes(q),
  )
}

/** Live FastAPI-backed gradebook reads. */
export class FastApiGradebookDataProvider implements GradebookDataProvider {
  async getMyGradebook(filters?: GradebookFilters): Promise<GradebookOverview> {
    const data = await apiFetch<ApiOverview>('/grades/me')
    return {
      entries: filterEntries(data.entries ?? [], filters),
      summary: data.summary ?? {},
      categories: data.categories ?? [],
      student: data.student ?? null,
    }
  }

  async getAssignment(assignmentId: string): Promise<GradeAssignmentDetail> {
    return apiFetch<GradeAssignmentDetail>(`/grades/assignments/${assignmentId}`)
  }

  async getSubmissionHistory(
    _assignmentId: string,
  ): Promise<SubmissionHistoryItem[]> {
    return []
  }

  async getMySubmission(_assignmentId: string): Promise<GradeSubmission | null> {
    return null
  }

  /** Roster for mass grading — path param is the assignment id. */
  async getEventGradebook(assignmentId: string): Promise<EventGradebook> {
    return apiFetch<EventGradebook>(
      `/grades/assignments/${assignmentId}/roster`,
    )
  }

  async getStudentGradebook(studentId: string): Promise<StudentGradebook> {
    const data = await apiFetch<ApiOverview>(`/grades/users/${studentId}`)
    const overview: GradebookOverview = {
      entries: data.entries ?? [],
      summary: data.summary ?? {},
      categories: data.categories ?? [],
      student: data.student ?? {
        id: studentId,
        name: 'Student',
        committee: null,
      },
    }
    return {
      student: overview.student!,
      overview,
    }
  }

  async getAssignmentRequests(): Promise<AssignmentDraftRequest[]> {
    const data = await apiFetch<{ requests: AssignmentDraftRequest[] }>(
      '/grades/assignment-requests',
    )
    return data.requests ?? []
  }
}

/** Live FastAPI-backed gradebook writes. */
export class FastApiGradebookCommandProvider implements GradebookCommandProvider {
  async updateGrade(
    entryId: string,
    input: GradeUpdateInput,
  ): Promise<GradebookEntry> {
    const scoreFromRubric =
      input.rubricScores?.reduce(
        (sum, row) => sum + (typeof row.pointsEarned === 'number' ? row.pointsEarned : 0),
        0,
      ) ?? undefined
    const body = await apiFetch<{ entry: GradebookEntry }>(
      `/grades/entries/${entryId}/grade`,
      {
        method: 'POST',
        body: JSON.stringify({
          score: input.score ?? scoreFromRubric ?? null,
          status: input.status ?? 'graded',
        }),
      },
    )
    return body.entry
  }

  async markExcused(entryId: string): Promise<GradebookEntry> {
    const body = await apiFetch<{ entry: GradebookEntry }>(
      `/grades/entries/${entryId}/grade`,
      {
        method: 'POST',
        body: JSON.stringify({ score: null, status: 'excused' }),
      },
    )
    return body.entry
  }

  async publishGrades(entryIds: string[]): Promise<GradebookEntry[]> {
    const body = await apiFetch<{ entries: GradebookEntry[] }>('/grades/publish', {
      method: 'POST',
      body: JSON.stringify({ entryIds }),
    })
    return body.entries ?? []
  }

  async bulkUpdateGrades(items: BulkGradeItem[]): Promise<GradebookEntry[]> {
    const body = await apiFetch<{ entries: GradebookEntry[] }>(
      '/grades/entries/bulk-grade',
      {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            entryId: item.entryId,
            score: item.score ?? null,
            status: item.status ?? 'graded',
          })),
        }),
      },
    )
    return body.entries ?? []
  }

  async createAssignment(input: {
    title: string
    categoryId: string
    pointsPossible?: number
    assignmentType?: string
    description?: string | null
    dueAt?: string | null
  }): Promise<{ id: string; title: string }> {
    const body = await apiFetch<{
      assignment: { id: string; title: string }
    }>('/grades/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        categoryId: input.categoryId,
        pointsPossible: input.pointsPossible ?? 10,
        assignmentType: input.assignmentType ?? 'custom',
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
      }),
    })
    return body.assignment
  }
}

/** Auth surface backed by `/auth/me` permissions. */
export class FastApiGradebookAuthProvider implements GradebookAuthProvider {
  private permissions: GradebookPermission[] = []
  private ready: Promise<void>

  constructor() {
    this.ready = this.refresh()
  }

  private async refresh(): Promise<void> {
    try {
      const me = await fetchCurrentUser()
      this.permissions = mapBackendGradePermissions(me.permissions ?? [])
    } catch {
      this.permissions = []
    }
  }

  async getCurrentUser() {
    await this.ready
    const me = await fetchCurrentUser()
    this.permissions = mapBackendGradePermissions(me.permissions ?? [])
    const committee = me.committees?.[0]
    return {
      id: me.id,
      name: me.full_name?.trim() || me.email,
      committeeName: committee?.name ?? null,
    }
  }

  hasPermission(permission: GradebookPermission): boolean {
    return this.permissions.includes(permission)
  }

  getPermissions(): GradebookPermission[] {
    return [...this.permissions]
  }
}

export async function fetchGradeAssignments(): Promise<
  { id: string; title: string; pointsPossible: number }[]
> {
  const data = await apiFetch<{
    assignments: { id: string; title: string; pointsPossible: number }[]
  }>('/grades/assignments')
  return data.assignments ?? []
}
