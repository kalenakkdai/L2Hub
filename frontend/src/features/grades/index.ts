export type * from './types'
export type {
  GradebookDataProvider,
  GradebookCommandProvider,
  GradebookAuthProvider,
  InjectedSupabaseClient,
  SupabaseGradebookConfig,
} from './api/contracts'

export {
  MockGradebookDataProvider,
  MockGradebookCommandProvider,
  MockGradebookAuthProvider,
  createStudentOnlyAuthProvider,
  statusLabel,
} from './api/mockGradebookAdapter'

export {
  SupabaseGradebookDataProvider,
  mapSupabaseGradeEntry,
  mapSupabaseHistoryItem,
} from './api/supabaseGradebookAdapter'

export {
  GradebookProvider,
  useGradebookContext,
} from './context/GradebookProvider'

export {
  useGradebook,
  useGradeAssignment,
  useSubmissionHistory,
  useMySubmission,
  useEventGradebook,
  useStudentGradebook,
  useGradebookPermissions,
  useGradebookCommands,
  gradebookKeys,
} from './hooks/useGradebook'

export { GradesPage } from './pages/GradesPage'
export { GradeAssignmentPage } from './pages/GradeAssignmentPage'
export { EventGradebookPage } from './pages/EventGradebookPage'
export { StudentGradebookPage } from './pages/StudentGradebookPage'
export { AssignmentRequestsPage } from './pages/AssignmentRequestsPage'
export { CommitteeGradeEntryPage } from './pages/CommitteeGradeEntryPage'

export { GradesLayout } from './components/GradesLayout'
export { GradeStatusIndicator } from './components/GradeStatusIndicator'
export { GradeSummary } from './components/GradeSummary'
export { GradeTable } from './components/GradeTable'
export { GradeFilters } from './components/GradeFilters'
