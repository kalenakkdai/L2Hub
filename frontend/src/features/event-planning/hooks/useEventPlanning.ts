import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEventPlanningContext } from '../context/EventPlanningProvider'
import type {
  AssignToPlanInput,
  CreateEventPlanInput,
  SubmitPlanningReportInput,
} from '../types'

export const planningKeys = {
  plans: ['event-planning', 'plans'] as const,
  plan: (planId: string) => ['event-planning', 'plan', planId] as const,
  members: ['event-planning', 'members'] as const,
  committees: ['event-planning', 'committees'] as const,
  reports: (planId: string) => ['event-planning', 'reports', planId] as const,
}

export function usePlanningAuth() {
  const { authProvider } = useEventPlanningContext()
  const userQuery = useQuery({
    queryKey: ['event-planning', 'me'],
    queryFn: () => authProvider.getCurrentUser(),
  })
  return {
    userQuery,
    hasPermission: authProvider.hasPermission.bind(authProvider),
  }
}

export function useEventPlans() {
  const { dataProvider } = useEventPlanningContext()
  return useQuery({
    queryKey: planningKeys.plans,
    queryFn: () => dataProvider.listPlans(),
  })
}

export function useEventPlan(planId: string) {
  const { dataProvider } = useEventPlanningContext()
  return useQuery({
    queryKey: planningKeys.plan(planId),
    queryFn: () => dataProvider.getPlan(planId),
    enabled: Boolean(planId),
  })
}

export function usePlanningDirectory() {
  const { dataProvider } = useEventPlanningContext()
  const members = useQuery({
    queryKey: planningKeys.members,
    queryFn: () => dataProvider.listMembers(),
  })
  const committees = useQuery({
    queryKey: planningKeys.committees,
    queryFn: () => dataProvider.listCommittees(),
  })
  return { members, committees }
}

export function usePlanningReports(planId: string, enabled: boolean) {
  const { dataProvider } = useEventPlanningContext()
  return useQuery({
    queryKey: planningKeys.reports(planId),
    queryFn: () => dataProvider.listAnonymousReports(planId),
    enabled: Boolean(planId) && enabled,
  })
}

export function usePlanningCommands(planId?: string) {
  const { dataProvider } = useEventPlanningContext()
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: planningKeys.plans })
    if (planId) {
      await queryClient.invalidateQueries({
        queryKey: planningKeys.plan(planId),
      })
      await queryClient.invalidateQueries({
        queryKey: planningKeys.reports(planId),
      })
    }
  }

  const createPlan = useMutation({
    mutationFn: (input: CreateEventPlanInput) => dataProvider.createPlan(input),
    onSuccess: invalidate,
  })
  const submitForEnablement = useMutation({
    mutationFn: (id: string) => dataProvider.submitForEnablement(id),
    onSuccess: invalidate,
  })
  const enablePlan = useMutation({
    mutationFn: (id: string) => dataProvider.enablePlan(id),
    onSuccess: invalidate,
  })
  const assign = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: AssignToPlanInput
    }) => dataProvider.assign(id, input),
    onSuccess: invalidate,
  })
  const acceptAssignment = useMutation({
    mutationFn: ({
      id,
      assignmentId,
    }: {
      id: string
      assignmentId: string
    }) => dataProvider.acceptAssignment(id, assignmentId),
    onSuccess: invalidate,
  })
  const declineAssignment = useMutation({
    mutationFn: ({
      id,
      assignmentId,
    }: {
      id: string
      assignmentId: string
    }) => dataProvider.declineAssignment(id, assignmentId),
    onSuccess: invalidate,
  })
  const submitReport = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: SubmitPlanningReportInput
    }) => dataProvider.submitAnonymousReport(id, input),
    onSuccess: invalidate,
  })
  const searchKnowledge = useMutation({
    mutationFn: (query: string) => dataProvider.searchKnowledge(query),
  })

  return {
    createPlan,
    submitForEnablement,
    enablePlan,
    assign,
    acceptAssignment,
    declineAssignment,
    submitReport,
    searchKnowledge,
  }
}
