import { apiFetch } from '../../../api/client'
import { fetchCurrentUser } from '../../../api/auth'
import { buildPlanAgendaDocument } from '../lib/planAgenda'
import { runPlanningRag } from '../lib/rag'
import type {
  AssignToPlanInput,
  CreateEventPlanInput,
  EventPlan,
  PlanningCommittee,
  PlanningMember,
  PlanningPermission,
  PlanningReport,
  PlanningRagResult,
  SubmitPlanningReportInput,
} from '../types'
import type {
  EventPlanningAuthProvider,
  EventPlanningDataProvider,
} from './mockPlanningAdapter'

/** Live event-planning boards. Knowledge search stays on the local corpus. */
export class FastApiEventPlanningDataProvider implements EventPlanningDataProvider {
  listPlans(): Promise<EventPlan[]> {
    return apiFetch<EventPlan[]>('/event-plans')
  }

  getPlan(planId: string): Promise<EventPlan> {
    return apiFetch<EventPlan>(`/event-plans/${planId}`)
  }

  createPlan(input: CreateEventPlanInput): Promise<EventPlan> {
    const agenda =
      input.initialAgenda ??
      buildPlanAgendaDocument({
        title: input.title,
        summary: input.summary,
        eventDate: input.eventDate,
      })
    return apiFetch<EventPlan>('/event-plans', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        summary: input.summary,
        eventDate: input.eventDate ?? null,
        agenda,
        initialAssignments: input.initialAssignments ?? [],
      }),
    })
  }

  submitForEnablement(planId: string): Promise<EventPlan> {
    return apiFetch<EventPlan>(`/event-plans/${planId}/submit`, { method: 'POST' })
  }

  enablePlan(planId: string): Promise<EventPlan> {
    return apiFetch<EventPlan>(`/event-plans/${planId}/enable`, { method: 'POST' })
  }

  assign(planId: string, input: AssignToPlanInput): Promise<EventPlan> {
    return apiFetch<EventPlan>(`/event-plans/${planId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  acceptAssignment(planId: string, assignmentId: string): Promise<EventPlan> {
    return apiFetch<EventPlan>(
      `/event-plans/${planId}/assignments/${assignmentId}/accept`,
      { method: 'POST' },
    )
  }

  declineAssignment(planId: string, assignmentId: string): Promise<EventPlan> {
    return apiFetch<EventPlan>(
      `/event-plans/${planId}/assignments/${assignmentId}/decline`,
      { method: 'POST' },
    )
  }

  listMembers(): Promise<PlanningMember[]> {
    return apiFetch<PlanningMember[]>('/event-plans/members')
  }

  listCommittees(): Promise<PlanningCommittee[]> {
    return apiFetch<PlanningCommittee[]>('/event-plans/committees')
  }

  async submitAnonymousReport(
    planId: string,
    input: SubmitPlanningReportInput,
  ): Promise<void> {
    await apiFetch(`/event-plans/${planId}/reports`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  listAnonymousReports(planId: string): Promise<PlanningReport[]> {
    return apiFetch<PlanningReport[]>(`/event-plans/${planId}/reports`)
  }

  searchKnowledge(query: string): Promise<PlanningRagResult> {
    return Promise.resolve(runPlanningRag(query))
  }
}

/**
 * Permissions come from /auth/me. hasPermission is read after getCurrentUser
 * resolves, which is how the planning pages already wait.
 */
export class FastApiEventPlanningAuthProvider implements EventPlanningAuthProvider {
  private permissions: string[] = []

  async getCurrentUser(): Promise<PlanningMember | null> {
    const me = await fetchCurrentUser()
    this.permissions = me.permissions ?? []
    const committee = me.committees?.[0]
    return {
      id: me.id,
      name: me.full_name?.trim() || me.email,
      committeeId: committee?.id ?? null,
      committeeName: committee?.name ?? null,
    }
  }

  hasPermission(permission: PlanningPermission): boolean {
    return this.permissions.includes(permission)
  }
}
