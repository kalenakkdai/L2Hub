import { useQuery } from '@tanstack/react-query'
import { useGradebookContext } from '../context/GradebookProvider'
import type { GradebookFilters } from '../types'

export const gradebookKeys = {
  me: (filters?: GradebookFilters) =>
    ['gradebook', 'me', filters ?? {}] as const,
  assignment: (assignmentId: string) =>
    ['gradebook', 'assignment', assignmentId] as const,
  history: (assignmentId: string) =>
    ['gradebook', 'history', assignmentId] as const,
  submission: (assignmentId: string) =>
    ['gradebook', 'submission', assignmentId] as const,
  event: (eventId: string) => ['gradebook', 'event', eventId] as const,
  student: (studentId: string) => ['gradebook', 'student', studentId] as const,
}

export function useGradebook(filters?: GradebookFilters) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.me(filters),
    queryFn: () => dataProvider.getMyGradebook(filters),
  })
}

export function useGradeAssignment(assignmentId: string) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.assignment(assignmentId),
    queryFn: () => dataProvider.getAssignment(assignmentId),
    enabled: Boolean(assignmentId),
  })
}

export function useSubmissionHistory(assignmentId: string) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.history(assignmentId),
    queryFn: () => dataProvider.getSubmissionHistory(assignmentId),
    enabled: Boolean(assignmentId),
  })
}

export function useMySubmission(assignmentId: string) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.submission(assignmentId),
    queryFn: () => dataProvider.getMySubmission(assignmentId),
    enabled: Boolean(assignmentId),
  })
}

export function useEventGradebook(eventId: string) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.event(eventId),
    queryFn: () => {
      if (!dataProvider.getEventGradebook) {
        throw new Error('Event gradebook is not available from this provider')
      }
      return dataProvider.getEventGradebook(eventId)
    },
    enabled: Boolean(eventId) && Boolean(dataProvider.getEventGradebook),
  })
}

export function useStudentGradebook(studentId: string) {
  const { dataProvider } = useGradebookContext()
  return useQuery({
    queryKey: gradebookKeys.student(studentId),
    queryFn: () => {
      if (!dataProvider.getStudentGradebook) {
        throw new Error('Student gradebook is not available from this provider')
      }
      return dataProvider.getStudentGradebook(studentId)
    },
    enabled: Boolean(studentId) && Boolean(dataProvider.getStudentGradebook),
  })
}

export function useGradebookPermissions() {
  const { authProvider } = useGradebookContext()
  return {
    hasPermission: (permission: Parameters<typeof authProvider.hasPermission>[0]) =>
      authProvider.hasPermission(permission),
    permissions: authProvider.getPermissions(),
    getCurrentUser: () => authProvider.getCurrentUser(),
  }
}

export function useGradebookCommands() {
  const { commandProvider } = useGradebookContext()
  return commandProvider
}
