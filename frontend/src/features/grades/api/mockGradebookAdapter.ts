import type {
  GradebookAuthProvider,
  GradebookCommandProvider,
  GradebookDataProvider,
} from './contracts'
import type {
  AssignmentRubric,
  EventDebriefSubmissionContent,
  EventGradebook,
  GradeAssignmentDetail,
  GradebookEntry,
  GradebookFilters,
  GradebookOverview,
  GradebookPermission,
  GradeCategory,
  GradeFeedback,
  GradeSubmission,
  GradeUpdateInput,
  RubricCriterion,
  RubricCriterionScore,
  StudentGradebook,
  SubmissionHistoryItem,
} from '../types'
import {
  ensureDefaultRubric,
  evaluateRubric,
} from '../utils/rubric'
import { withWeightedSummary } from '../utils/weights'

const ISO = {
  opened: '2026-08-10T15:00:00.000Z',
  due: '2026-08-12T22:45:00.000Z',
  lateDue: '2026-08-13T06:59:00.000Z',
  submitted: '2026-08-12T22:43:00.000Z',
  graded: '2026-08-12T22:43:30.000Z',
  draftCreated: '2026-08-12T22:38:00.000Z',
  draftSaved: '2026-08-12T22:40:00.000Z',
  springDue: '2026-08-15T00:00:00.000Z',
  reflectionDue: '2026-08-14T06:59:00.000Z',
  reflectionSubmitted: '2026-08-14T07:16:00.000Z',
}

/** Anonymized class percents for demos — never paired with student identities. */
const MAZE_DISTRIBUTION_PERCENTS = [
  100, 100, 100, 100, 100, 100, 100, 100, 90, 90, 90, 80, 80, 70, 60, 50,
]
const REFLECTION_DISTRIBUTION_PERCENTS = [
  100, 90, 90, 80, 80, 80, 70, 70, 60, 50, 40,
]

/** Canvas-style assignment groups — weights sum to 100. */
const DEFAULT_CATEGORIES: GradeCategory[] = [
  { id: 'cat-debriefs', name: 'Event debriefs', weightPercent: 40 },
  { id: 'cat-reflections', name: 'Reflections', weightPercent: 25 },
  { id: 'cat-deliverables', name: 'Deliverables', weightPercent: 20 },
  { id: 'cat-participation', name: 'Participation', weightPercent: 15 },
]

function buildEntries(): GradebookEntry[] {
  return [
    {
      id: 'entry-maze-debrief',
      assignmentId: 'asg-maze-debrief',
      assignmentTitle: 'Maze Day - Debrief Submission',
      assignmentType: 'event_debrief',
      event: { id: 'evt-maze', name: 'Maze Day' },
      committee: { id: 'com-events', name: 'Events Committee' },
      status: 'graded',
      score: 10,
      pointsPossible: 10,
      categoryId: 'cat-debriefs',
      availableAt: ISO.opened,
      dueAt: ISO.due,
      lateDueAt: ISO.lateDue,
      submittedAt: ISO.submitted,
      gradedAt: ISO.graded,
      isLate: false,
      canSubmit: false,
      canResubmit: false,
      acceptingLateSubmissions: true,
      distribution: {
        scorePercents: MAZE_DISTRIBUTION_PERCENTS,
        yourPercent: 100,
      },
    },
    {
      id: 'entry-spring-materials',
      assignmentId: 'asg-spring-materials',
      assignmentTitle: 'Spring Formal Materials Checklist',
      assignmentType: 'material_checklist',
      event: { id: 'evt-spring', name: 'Spring Formal' },
      status: 'not_started',
      score: null,
      pointsPossible: 10,
      categoryId: 'cat-deliverables',
      availableAt: ISO.opened,
      dueAt: ISO.springDue,
      submittedAt: null,
      isLate: false,
      canSubmit: true,
      canResubmit: false,
    },
    {
      id: 'entry-reflection',
      assignmentId: 'asg-reflection',
      assignmentTitle: 'Leadership Reflection',
      assignmentType: 'reflection',
      event: { id: 'evt-weekly', name: 'Weekly Leadership' },
      status: 'late',
      score: 7,
      pointsPossible: 10,
      categoryId: 'cat-reflections',
      availableAt: ISO.opened,
      dueAt: ISO.reflectionDue,
      submittedAt: ISO.reflectionSubmitted,
      gradedAt: ISO.reflectionSubmitted,
      isLate: true,
      canSubmit: false,
      canResubmit: false,
      distribution: {
        scorePercents: REFLECTION_DISTRIBUTION_PERCENTS,
        yourPercent: 80,
      },
    },
    {
      id: 'entry-missing',
      assignmentId: 'asg-meeting-notes',
      assignmentTitle: 'Cabinet Meeting Response',
      assignmentType: 'meeting_response',
      event: { id: 'evt-cabinet', name: 'Cabinet Meeting' },
      status: 'missing',
      score: 0,
      pointsPossible: 10,
      categoryId: 'cat-participation',
      dueAt: '2026-08-01T06:59:00.000Z',
      submittedAt: null,
      isLate: true,
      canSubmit: false,
      distribution: {
        scorePercents: [100, 100, 90, 90, 80, 70, 60, 0, 0, 0],
        yourPercent: 0,
      },
    },
    {
      id: 'entry-excused',
      assignmentId: 'asg-attendance',
      assignmentTitle: 'Rally Night Attendance',
      assignmentType: 'attendance',
      event: { id: 'evt-rally', name: 'Rally Night' },
      status: 'excused',
      score: null,
      pointsPossible: 5,
      categoryId: 'cat-participation',
      dueAt: '2026-07-20T06:59:00.000Z',
      submittedAt: null,
    },
    {
      id: 'entry-draft',
      assignmentId: 'asg-committee-deliverable',
      assignmentTitle: 'Publicity Flyer Draft',
      assignmentType: 'committee_deliverable',
      event: { id: 'evt-spirit-week', name: 'Spirit Week' },
      committee: { id: 'com-publicity', name: 'Publicity Committee' },
      status: 'draft',
      score: null,
      pointsPossible: 15,
      categoryId: 'cat-deliverables',
      dueAt: '2026-08-20T06:59:00.000Z',
      canSubmit: true,
    },
  ]
}

const debriefContent: EventDebriefSubmissionContent = {
  overallRating: 5,
  overallMaxRating: 5,
  committeeRatings: [
    {
      committeeId: 'com-community',
      committeeName: 'Community',
      rating: 5,
      maxRating: 5,
    },
    {
      committeeId: 'com-spirit',
      committeeName: 'Spirit',
      rating: 4,
      maxRating: 5,
    },
    {
      committeeId: 'com-publicity',
      committeeName: 'Publicity',
      rating: null,
      maxRating: 5,
    },
  ],
  strengths: [
    'Check-in lines moved quickly.',
    'Volunteers knew their responsibilities.',
    'Directional signage was clear.',
  ],
  improvements: [
    'Set up thirty minutes earlier.',
    'Bring two additional extension cords.',
    'Create separate parent/student entry signs.',
  ],
  materialRequests: [
    {
      id: 'mat-1',
      name: 'Extension cords',
      quantity: 2,
      reason: 'Existing cords did not reach the outdoor station.',
      purchasingUrl: 'https://example.com/extension-cords',
    },
  ],
  hasAnonymousConcern: true,
  anonymousConcernVisibleText: null,
}

const feedback: GradeFeedback = {
  kind: 'completion_criteria',
  summary: 'Completion grading for debrief requirements.',
  items: [
    { id: 'c1', label: 'Overall rating completed', passed: true },
    { id: 'c2', label: 'Committee ratings completed', passed: true },
    { id: 'c3', label: 'Three strengths completed', passed: true },
    { id: 'c4', label: 'Three improvements completed', passed: true },
    { id: 'c5', label: 'Submitted within session', passed: true, pointsEarned: 10, pointsPossible: 10 },
  ],
}

function debriefRubric(): AssignmentRubric {
  return ensureDefaultRubric([
    {
      id: 'ratings',
      label: 'Event & committee ratings',
      description: 'Overall and committee ratings are complete.',
      pointsPossible: 4,
      kind: 'manual',
    },
    {
      id: 'strengths-improvements',
      label: 'Strengths & improvements',
      description: 'Exactly three strengths and three improvements.',
      pointsPossible: 4,
      kind: 'manual',
    },
    {
      id: 'materials',
      label: 'Materials / notes',
      description: 'Optional materials requests are clear when present.',
      pointsPossible: 2,
      kind: 'manual',
    },
  ])
}

function reflectionRubric(): AssignmentRubric {
  return ensureDefaultRubric([
    {
      id: 'depth',
      label: 'Reflection depth',
      pointsPossible: 6,
      kind: 'manual',
    },
    {
      id: 'clarity',
      label: 'Clarity',
      pointsPossible: 4,
      kind: 'manual',
    },
  ])
}

function genericRubric(pointsPossible: number): AssignmentRubric {
  const content: RubricCriterion = {
    id: 'content',
    label: 'Assignment content',
    pointsPossible,
    kind: 'manual',
  }
  return ensureDefaultRubric([content])
}

function rubricFor(assignmentId: string, pointsPossible: number): AssignmentRubric {
  if (assignmentId === 'asg-maze-debrief') return debriefRubric()
  if (assignmentId === 'asg-reflection') return reflectionRubric()
  return genericRubric(pointsPossible > 0 ? pointsPossible : 10)
}

function defaultScoresFor(assignmentId: string): RubricCriterionScore[] {
  if (assignmentId === 'asg-maze-debrief') {
    return [
      { criterionId: 'ratings', pointsEarned: 4 },
      { criterionId: 'strengths-improvements', pointsEarned: 4 },
      { criterionId: 'materials', pointsEarned: 2 },
    ]
  }
  if (assignmentId === 'asg-reflection') {
    return [
      { criterionId: 'depth', pointsEarned: 5 },
      { criterionId: 'clarity', pointsEarned: 3 },
    ]
  }
  return []
}

function matchesStatusFilter(
  entry: GradebookEntry,
  status: GradebookFilters['status'],
): boolean {
  if (!status || status === 'all') return true
  if (status === 'open') {
    return entry.status === 'not_started' || entry.status === 'draft'
  }
  if (status === 'upcoming') {
    return (
      (entry.status === 'not_started' || entry.status === 'draft') &&
      Boolean(entry.dueAt)
    )
  }
  return entry.status === status
}

function filterEntries(
  entries: GradebookEntry[],
  filters?: GradebookFilters,
): GradebookEntry[] {
  if (!filters) return entries
  return entries.filter((entry) => {
    if (!matchesStatusFilter(entry, filters.status)) return false
    if (filters.eventId && entry.event?.id !== filters.eventId) return false
    if (
      filters.assignmentType &&
      entry.assignmentType !== filters.assignmentType
    ) {
      return false
    }
    if (
      filters.committeeId &&
      entry.committee?.id !== filters.committeeId
    ) {
      return false
    }
    if (filters.query) {
      const q = filters.query.trim().toLowerCase()
      const haystack = [
        entry.assignmentTitle,
        entry.event?.name ?? '',
        entry.assignmentType,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

function summarize(entries: GradebookEntry[]) {
  const completed = entries.filter((e) =>
    e.status === 'graded' || e.status === 'submitted' || e.status === 'late' || e.status === 'excused',
  ).length
  const missing = entries.filter((e) => e.status === 'missing').length
  const open = entries.filter(
    (e) => e.status === 'not_started' || e.status === 'draft',
  ).length
  const earnedPoints = entries.reduce(
    (sum, e) => sum + (typeof e.score === 'number' ? e.score : 0),
    0,
  )
  const possiblePoints = entries.reduce(
    (sum, e) => sum + (typeof e.pointsPossible === 'number' ? e.pointsPossible : 0),
    0,
  )
  const completionPercent =
    possiblePoints > 0
      ? Math.round((earnedPoints / possiblePoints) * 1000) / 10
      : undefined

  return withWeightedSummary(
    {
      completed,
      missing,
      open,
      earnedPoints,
      possiblePoints,
      completionPercent,
    },
    DEFAULT_CATEGORIES,
    entries,
  )
}

function historyFor(assignmentId: string): SubmissionHistoryItem[] {
  if (assignmentId === 'asg-maze-debrief') {
    return [
      {
        id: 'h1',
        type: 'draft_created',
        occurredAt: ISO.draftCreated,
        label: 'Draft created',
      },
      {
        id: 'h2',
        type: 'draft_saved',
        occurredAt: ISO.draftSaved,
        label: 'Draft auto-saved',
      },
      {
        id: 'h3',
        type: 'submitted',
        occurredAt: ISO.submitted,
        label: 'Submitted',
      },
      {
        id: 'h4',
        type: 'graded',
        occurredAt: ISO.graded,
        label: 'Grade recorded',
        description: '10 / 10',
      },
    ]
  }
  if (assignmentId === 'asg-reflection') {
    return [
      {
        id: 'h5',
        type: 'submitted',
        occurredAt: ISO.reflectionSubmitted,
        label: 'Submitted',
        description: 'Submitted after due time',
      },
      {
        id: 'h6',
        type: 'graded',
        occurredAt: ISO.reflectionSubmitted,
        label: 'Grade recorded',
        description: '8 / 10',
      },
    ]
  }
  return []
}

function submissionFor(assignmentId: string): GradeSubmission | null {
  if (assignmentId === 'asg-maze-debrief') {
    return {
      id: 'sub-maze',
      assignmentId,
      submittedAt: ISO.submitted,
      isLate: false,
      attempt: 1,
      content: { type: 'event_debrief', data: debriefContent },
    }
  }
  if (assignmentId === 'asg-reflection') {
    return {
      id: 'sub-reflection',
      assignmentId,
      submittedAt: ISO.reflectionSubmitted,
      isLate: true,
      attempt: 1,
      content: {
        type: 'reflection',
        data: {
          prompt: 'What did you learn about leading under time pressure?',
          body: 'I learned to communicate earlier with station leads and to prepare backup materials before the event begins.',
        },
      },
    }
  }
  if (assignmentId === 'asg-committee-deliverable') {
    return {
      id: 'sub-draft',
      assignmentId,
      submittedAt: null,
      isLate: false,
      attempt: 1,
      content: {
        type: 'generic',
        data: {
          title: 'Publicity Flyer Draft',
          body: 'Draft notes: include Maze Day photo and QR code for volunteer signup.',
          checklist: [
            { id: 'd1', label: 'Headline written', completed: true },
            { id: 'd2', label: 'Print vendor contacted', completed: false },
          ],
        },
      },
    }
  }
  return null
}

export type MockGradebookOptions = {
  entries?: GradebookEntry[]
  failOnGetMyGradebook?: boolean
  failMessage?: string
}

/**
 * In-memory provider for UI development and unit tests.
 * Demonstrates DI: pages render whatever this returns without knowing the source.
 */
export class MockGradebookDataProvider implements GradebookDataProvider {
  private entries: GradebookEntry[]
  private rubricScoresByEntryId: Map<string, RubricCriterionScore[]>
  private failOnGetMyGradebook: boolean
  private failMessage: string

  constructor(options: MockGradebookOptions = {}) {
    this.entries = options.entries ?? buildEntries()
    this.rubricScoresByEntryId = new Map(
      this.entries.map((entry) => [
        entry.id,
        defaultScoresFor(entry.assignmentId),
      ]),
    )
    this.failOnGetMyGradebook = options.failOnGetMyGradebook ?? false
    this.failMessage = options.failMessage ?? 'Mock gradebook unavailable'
  }

  async getMyGradebook(filters?: GradebookFilters): Promise<GradebookOverview> {
    if (this.failOnGetMyGradebook) {
      throw new Error(this.failMessage)
    }
    const entries = filterEntries(this.entries, filters)
    return {
      entries,
      categories: DEFAULT_CATEGORIES,
      summary: summarize(this.entries),
      student: {
        id: 'stu-kalena',
        name: 'Kalena Dai',
        committee: { id: 'com-events', name: 'Events Committee' },
      },
    }
  }

  async getAssignment(assignmentId: string): Promise<GradeAssignmentDetail> {
    const entry = this.entries.find((e) => e.assignmentId === assignmentId)
    if (!entry) {
      throw new Error('Assignment not found')
    }

    const rubric = rubricFor(
      assignmentId,
      entry.pointsPossible ?? 10,
    )
    const submission = submissionFor(assignmentId)
    const scores = this.rubricScoresByEntryId.get(entry.id) ?? []
    const rubricEvaluation = evaluateRubric({
      rubric,
      scores,
      dueAt: entry.dueAt,
      submittedAt: submission?.submittedAt ?? entry.submittedAt,
    })

    return {
      entry,
      submission,
      feedback: assignmentId === 'asg-maze-debrief' ? feedback : null,
      rubric,
      rubricEvaluation,
      student: {
        id: 'stu-kalena',
        name: 'Kalena Dai',
        committee: { id: 'com-events', name: 'Events Committee' },
      },
    }
  }

  /** Test / command helper: persist assigner rubric scores for an entry. */
  setRubricScores(entryId: string, scores: RubricCriterionScore[]): void {
    this.rubricScoresByEntryId.set(entryId, scores)
  }

  getEntryById(entryId: string): GradebookEntry | undefined {
    return this.entries.find((entry) => entry.id === entryId)
  }

  async getSubmissionHistory(
    assignmentId: string,
  ): Promise<SubmissionHistoryItem[]> {
    return historyFor(assignmentId)
  }

  async getMySubmission(assignmentId: string): Promise<GradeSubmission | null> {
    return submissionFor(assignmentId)
  }

  async getEventGradebook(eventId: string): Promise<EventGradebook> {
    const related = this.entries.find((e) => e.event?.id === eventId)
    if (!related?.event) {
      throw new Error('Event gradebook not found')
    }
    return {
      event: related.event,
      assignmentTitle: related.assignmentTitle,
      assignmentId: related.assignmentId,
      completionCompleted: 46,
      completionTotal: 50,
      rows: [
        {
          studentId: 'stu-avery',
          studentName: 'Avery Chen',
          committee: { id: 'com-community', name: 'Community' },
          status: 'submitted',
          score: 10,
          pointsPossible: 10,
          entryId: 'row-avery',
          assignmentId: related.assignmentId,
        },
        {
          studentId: 'stu-jordan',
          studentName: 'Jordan Lee',
          committee: { id: 'com-spirit', name: 'Spirit' },
          status: 'submitted',
          score: 10,
          pointsPossible: 10,
          entryId: 'row-jordan',
          assignmentId: related.assignmentId,
        },
        {
          studentId: 'stu-taylor',
          studentName: 'Taylor Kim',
          committee: { id: 'com-rally', name: 'Rally' },
          status: 'missing',
          score: 0,
          pointsPossible: 10,
          entryId: 'row-taylor',
          assignmentId: related.assignmentId,
        },
        {
          studentId: 'stu-morgan',
          studentName: 'Morgan Liu',
          committee: { id: 'com-publicity', name: 'Publicity' },
          status: 'excused',
          score: null,
          pointsPossible: 10,
          entryId: 'row-morgan',
          assignmentId: related.assignmentId,
          isAbsent: true,
        },
      ],
    }
  }

  async getStudentGradebook(studentId: string): Promise<StudentGradebook> {
    const overview = await this.getMyGradebook()
    return {
      student: {
        id: studentId,
        name: studentId === 'stu-avery' ? 'Avery Chen' : 'Kalena Dai',
        committee: { id: 'com-community', name: 'Community' },
      },
      overview,
    }
  }

  /** Test helper: replace dataset without changing page code. */
  setEntries(entries: GradebookEntry[]): void {
    this.entries = entries
    this.rubricScoresByEntryId = new Map(
      entries.map((entry) => [
        entry.id,
        defaultScoresFor(entry.assignmentId),
      ]),
    )
  }
}

export class MockGradebookCommandProvider implements GradebookCommandProvider {
  private data: MockGradebookDataProvider

  constructor(data: MockGradebookDataProvider) {
    this.data = data
  }

  async updateGrade(
    entryId: string,
    input: GradeUpdateInput,
  ): Promise<GradebookEntry> {
    const entry = this.data.getEntryById(entryId)
    if (!entry) throw new Error('Grade entry not found')

    if (input.rubricScores) {
      this.data.setRubricScores(entryId, input.rubricScores)
      const detail = await this.data.getAssignment(entry.assignmentId)
      if (
        detail.rubricEvaluation &&
        typeof detail.rubricEvaluation.earnedPoints === 'number'
      ) {
        entry.score = detail.rubricEvaluation.earnedPoints
        entry.status = 'graded'
      }
    }

    if (typeof input.score === 'number') entry.score = input.score
    if (input.status) entry.status = input.status
    return entry
  }

  async markExcused(entryId: string): Promise<GradebookEntry> {
    return this.updateGrade(entryId, { status: 'excused', score: null })
  }

  async reopenSubmission(_assignmentId: string, _studentId: string): Promise<void> {
    return
  }
}

export class MockGradebookAuthProvider implements GradebookAuthProvider {
  private permissions: GradebookPermission[]
  private user: {
    id: string
    name: string
    committeeName?: string | null
  }

  constructor(
    permissions: GradebookPermission[] = [
      'gradebook.view_own',
      'gradebook.view_event',
      'gradebook.view_student',
      'gradebook.edit',
      'gradebook.mark_excused',
      'debrief.reopen',
    ],
    user: {
      id: string
      name: string
      committeeName?: string | null
    } = {
      id: 'stu-kalena',
      name: 'Kalena Dai',
      committeeName: 'Events Committee',
    },
  ) {
    this.permissions = permissions
    this.user = user
  }

  async getCurrentUser() {
    return this.user
  }

  hasPermission(permission: GradebookPermission): boolean {
    return this.permissions.includes(permission)
  }

  getPermissions(): GradebookPermission[] {
    return [...this.permissions]
  }

  setPermissions(permissions: GradebookPermission[]): void {
    this.permissions = permissions
  }
}

export function createStudentOnlyAuthProvider(): MockGradebookAuthProvider {
  return new MockGradebookAuthProvider(['gradebook.view_own'], {
    id: 'stu-kalena',
    name: 'Kalena Dai',
    committeeName: 'Events Committee',
  })
}

export { statusLabel } from '../utils/status'
