import type {
  AssignToPlanInput,
  CreateEventPlanInput,
  EventPlan,
  PlanAssignment,
  PlanningCommittee,
  PlanningMember,
  PlanningPermission,
  PlanningReport,
  PlanningRagResult,
  SubmitPlanningReportInput,
} from '../types'
import { L2_ROSTER_COMMITTEES, primaryHead } from '../../../data/l2Roster'
import { runPlanningRag } from '../lib/rag'
import { buildPlanAgendaDocument } from '../lib/planAgenda'
import { sanitizeAttachmentDisplayName } from '../lib/reportAttachments'

export interface EventPlanningDataProvider {
  listPlans(): Promise<EventPlan[]>
  getPlan(planId: string): Promise<EventPlan>
  createPlan(input: CreateEventPlanInput): Promise<EventPlan>
  submitForEnablement(planId: string): Promise<EventPlan>
  enablePlan(planId: string): Promise<EventPlan>
  assign(planId: string, input: AssignToPlanInput): Promise<EventPlan>
  acceptAssignment(planId: string, assignmentId: string): Promise<EventPlan>
  declineAssignment(planId: string, assignmentId: string): Promise<EventPlan>
  listMembers(): Promise<PlanningMember[]>
  listCommittees(): Promise<PlanningCommittee[]>
  submitAnonymousReport(
    planId: string,
    input: SubmitPlanningReportInput,
  ): Promise<void>
  /** AC-only. Responses are redacted — never include author identity. */
  listAnonymousReports(planId: string): Promise<PlanningReport[]>
  searchKnowledge(query: string): Promise<PlanningRagResult>
}

export interface EventPlanningAuthProvider {
  getCurrentUser(): Promise<PlanningMember | null>
  hasPermission(permission: PlanningPermission): boolean
}

/** Demo operator kept so local planning auth still has a stable current user. */
const DEMO_OPERATOR: PlanningMember = {
  id: 'mem-kalena',
  name: 'Kalena Dai',
  committeeId: 'com-tech',
  committeeName: 'Tech',
}

const MEMBERS: PlanningMember[] = [
  DEMO_OPERATOR,
  ...L2_ROSTER_COMMITTEES.flatMap((committee) =>
    committee.members.map((name) => ({
      id: `mem-${committee.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      committeeId: `com-${committee.id}`,
      committeeName: committee.name,
    })),
  ),
]

const COMMITTEES: PlanningCommittee[] = L2_ROSTER_COMMITTEES.map((committee) => ({
  id: `com-${committee.id}`,
  name: committee.name,
}))

function memberIdFor(committeeId: string, name: string): string {
  return `mem-${committeeId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

const ACTIVITIES_HEAD = primaryHead(
  L2_ROSTER_COMMITTEES.find((c) => c.id === 'activities')!,
)!
const COMMUNITY_HEAD = primaryHead(
  L2_ROSTER_COMMITTEES.find((c) => c.id === 'community')!,
)!
const PUBLICITY_HEAD = primaryHead(
  L2_ROSTER_COMMITTEES.find((c) => c.id === 'publicity')!,
)!

type StoredReport = PlanningReport & {
  /** Stored for audit only — never returned from listAnonymousReports. */
  authorId: string
}

function seedPlans(): EventPlan[] {
  return [
    {
      id: 'plan-maze',
      title: 'Maze Day 2026',
      summary: 'Campus maze with timed stations and parent entry flow.',
      eventDate: '2026-10-18',
      status: 'pending_enablement',
      createdById: 'mem-kalena',
      createdByName: 'Kalena Dai',
      createdAt: '2026-08-01T17:00:00.000Z',
      agenda: buildPlanAgendaDocument({
        title: 'Maze Day 2026',
        summary: 'Campus maze with timed stations and parent entry flow.',
        eventDate: '2026-10-18',
        now: new Date('2026-08-01T17:00:00.000Z'),
      }),
      assignments: [
        {
          id: 'asg-1',
          targetType: 'committee',
          committeeId: 'com-activities',
          committeeName: 'Activities',
          roleLabel: 'Station leads',
          status: 'invited',
        },
        {
          id: 'asg-2',
          targetType: 'individual',
          memberId: memberIdFor('activities', ACTIVITIES_HEAD),
          memberName: ACTIVITIES_HEAD,
          roleLabel: 'Check-in captain',
          status: 'invited',
        },
      ],
    },
    {
      id: 'plan-rally',
      title: 'Fall Rally',
      summary: 'Gym spirit rally with section seating.',
      eventDate: '2026-09-12',
      status: 'enabled',
      createdById: memberIdFor('community', COMMUNITY_HEAD),
      createdByName: COMMUNITY_HEAD,
      createdAt: '2026-07-20T16:00:00.000Z',
      enabledAt: '2026-07-22T18:00:00.000Z',
      enabledByName: 'Mr. Jan',
      agenda: buildPlanAgendaDocument({
        title: 'Fall Rally',
        summary: 'Gym spirit rally with section seating.',
        eventDate: '2026-09-12',
        now: new Date('2026-07-20T16:00:00.000Z'),
      }),
      assignments: [
        {
          id: 'asg-3',
          targetType: 'committee',
          committeeId: 'com-sports',
          committeeName: 'Sports',
          roleLabel: 'Section energy',
          status: 'accepted',
        },
        {
          id: 'asg-4',
          targetType: 'individual',
          memberId: 'mem-kalena',
          memberName: 'Kalena Dai',
          roleLabel: 'Mic handoff',
          status: 'invited',
        },
        {
          id: 'asg-5',
          targetType: 'individual',
          memberId: memberIdFor('publicity', PUBLICITY_HEAD),
          memberName: PUBLICITY_HEAD,
          roleLabel: 'Spirit graphics',
          status: 'invited',
        },
      ],
    },
  ]
}

export class MockEventPlanningDataProvider implements EventPlanningDataProvider {
  private plans: EventPlan[]
  private reports: StoredReport[] = []
  private currentUserId: string

  constructor(options?: { currentUserId?: string; plans?: EventPlan[] }) {
    this.plans = options?.plans ? structuredClone(options.plans) : seedPlans()
    this.currentUserId = options?.currentUserId ?? 'mem-kalena'
  }

  async listPlans(): Promise<EventPlan[]> {
    return structuredClone(this.plans)
  }

  async getPlan(planId: string): Promise<EventPlan> {
    const plan = this.plans.find((item) => item.id === planId)
    if (!plan) throw new Error('Event plan not found')
    return structuredClone(plan)
  }

  async createPlan(input: CreateEventPlanInput): Promise<EventPlan> {
    const creator =
      MEMBERS.find((member) => member.id === this.currentUserId) ?? MEMBERS[0]
    const title = input.title.trim()
    const summary = input.summary.trim()
    const eventDate = input.eventDate || null
    const agenda =
      input.initialAgenda ??
      buildPlanAgendaDocument({ title, summary, eventDate })
    const assignments: PlanAssignment[] = []
    for (const draft of input.initialAssignments ?? []) {
      const committee =
        COMMITTEES.find(
          (item) =>
            item.id === draft.committeeId ||
            item.id === `com-${draft.committeeId}` ||
            item.name.toLowerCase() === (draft.committeeName ?? '').toLowerCase(),
        ) ?? null
      if (committee) {
        assignments.push(
          this.buildAssignment({
            targetType: 'committee',
            committeeId: committee.id,
            roleLabel: draft.roleLabel,
          }),
        )
      }
    }
    const plan: EventPlan = {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      title,
      summary,
      eventDate,
      status: 'draft',
      createdById: creator.id,
      createdByName: creator.name,
      createdAt: new Date().toISOString(),
      assignments,
      agenda,
    }
    this.plans.unshift(plan)
    return structuredClone(plan)
  }

  async submitForEnablement(planId: string): Promise<EventPlan> {
    const plan = this.requirePlan(planId)
    if (plan.status !== 'draft' && plan.status !== 'pending_enablement') {
      throw new Error('Only draft plans can be sent for enablement')
    }
    plan.status = 'pending_enablement'
    return structuredClone(plan)
  }

  async enablePlan(planId: string): Promise<EventPlan> {
    const plan = this.requirePlan(planId)
    plan.status = 'enabled'
    plan.enabledAt = new Date().toISOString()
    plan.enabledByName = 'Mr. Jan'
    return structuredClone(plan)
  }

  async assign(planId: string, input: AssignToPlanInput): Promise<EventPlan> {
    const plan = this.requirePlan(planId)
    const assignment = this.buildAssignment(input)
    plan.assignments.push(assignment)
    return structuredClone(plan)
  }

  async acceptAssignment(
    planId: string,
    assignmentId: string,
  ): Promise<EventPlan> {
    const plan = this.requirePlan(planId)
    if (plan.status !== 'enabled' && plan.status !== 'active') {
      throw new Error(
        'Mr. Jan or an ASBO must enable this plan before assignments can be accepted',
      )
    }
    const assignment = plan.assignments.find((item) => item.id === assignmentId)
    if (!assignment) throw new Error('Assignment not found')
    assignment.status = 'accepted'
    if (plan.status === 'enabled') plan.status = 'active'
    return structuredClone(plan)
  }

  async declineAssignment(
    planId: string,
    assignmentId: string,
  ): Promise<EventPlan> {
    const plan = this.requirePlan(planId)
    if (plan.status !== 'enabled' && plan.status !== 'active') {
      throw new Error(
        'Mr. Jan or an ASBO must enable this plan before assignments can be declined',
      )
    }
    const assignment = plan.assignments.find((item) => item.id === assignmentId)
    if (!assignment) throw new Error('Assignment not found')
    assignment.status = 'declined'
    return structuredClone(plan)
  }

  async listMembers(): Promise<PlanningMember[]> {
    return structuredClone(MEMBERS)
  }

  async listCommittees(): Promise<PlanningCommittee[]> {
    return structuredClone(COMMITTEES)
  }

  async submitAnonymousReport(
    planId: string,
    input: SubmitPlanningReportInput,
  ): Promise<void> {
    this.requirePlan(planId)
    const subject = MEMBERS.find((member) => member.id === input.subjectMemberId)
    if (!subject) throw new Error('Subject member not found')
    if (!input.details.trim()) throw new Error('Report details are required')

    const attachments = (input.attachments ?? []).map((attachment, index) => ({
      id: attachment.id || `att-${crypto.randomUUID().slice(0, 8)}`,
      displayName: sanitizeAttachmentDisplayName(attachment.mimeType, index),
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      dataUrl: attachment.dataUrl,
    }))

    this.reports.push({
      id: `rep-${crypto.randomUUID().slice(0, 8)}`,
      planId,
      subjectMemberId: subject.id,
      subjectMemberName: subject.name,
      category: input.category,
      details: input.details.trim(),
      attachments,
      createdAt: new Date().toISOString(),
      authorId: this.currentUserId,
    })
  }

  async listAnonymousReports(planId: string): Promise<PlanningReport[]> {
    // Strip authorId so even privileged callers never receive authorship.
    return this.reports
      .filter((report) => report.planId === planId)
      .map(({ authorId: _authorId, ...redacted }) => redacted)
  }

  async searchKnowledge(query: string): Promise<PlanningRagResult> {
    return runPlanningRag(query)
  }

  private requirePlan(planId: string): EventPlan {
    const plan = this.plans.find((item) => item.id === planId)
    if (!plan) throw new Error('Event plan not found')
    return plan
  }

  private buildAssignment(input: AssignToPlanInput): PlanAssignment {
    if (input.targetType === 'committee') {
      const committee = COMMITTEES.find((item) => item.id === input.committeeId)
      if (!committee) throw new Error('Committee not found')
      return {
        id: `asg-${crypto.randomUUID().slice(0, 8)}`,
        targetType: 'committee',
        committeeId: committee.id,
        committeeName: committee.name,
        roleLabel: input.roleLabel.trim() || 'Committee support',
        status: 'invited',
      }
    }

    const member = MEMBERS.find((item) => item.id === input.memberId)
    if (!member) throw new Error('Member not found')
    return {
      id: `asg-${crypto.randomUUID().slice(0, 8)}`,
      targetType: 'individual',
      memberId: member.id,
      memberName: member.name,
      roleLabel: input.roleLabel.trim() || 'Individual assignment',
      status: 'invited',
    }
  }
}

export class MockEventPlanningAuthProvider implements EventPlanningAuthProvider {
  private permissions: PlanningPermission[]
  private user: PlanningMember

  constructor(
    permissions: PlanningPermission[] = [
      'planning.view',
      'planning.create',
      'planning.assign',
      'knowledge.view',
    ],
    user: PlanningMember = MEMBERS[0],
  ) {
    this.permissions = permissions
    this.user = user
  }

  async getCurrentUser() {
    return this.user
  }

  hasPermission(permission: PlanningPermission): boolean {
    return this.permissions.includes(permission)
  }
}

export function createAcPlanningAuthProvider() {
  return new MockEventPlanningAuthProvider(
    [
      'planning.view',
      'planning.create',
      'planning.assign',
      'planning.enable',
      'feedback.view_anonymous',
      'knowledge.view',
    ],
    {
      id: 'mem-jan',
      name: 'Mr. Jan',
      committeeId: null,
      committeeName: null,
    },
  )
}

/** Jadon and other ASBOs — may enable plans, but not review anonymous feedback. */
export function createAsboPlanningAuthProvider() {
  return new MockEventPlanningAuthProvider(
    [
      'planning.view',
      'planning.create',
      'planning.assign',
      'planning.enable',
      'knowledge.view',
    ],
    {
      id: 'mem-jadon',
      name: 'Jadon Li',
      committeeId: null,
      committeeName: null,
    },
  )
}
