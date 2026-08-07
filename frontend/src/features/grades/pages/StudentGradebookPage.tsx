import { Link, useParams } from 'react-router-dom'
import { GradeSummary } from '../components/GradeSummary'
import { GradeTable } from '../components/GradeTable'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import {
  useGradebookPermissions,
  useStudentGradebook,
} from '../hooks/useGradebook'

export function StudentGradebookPage() {
  const { studentId = '' } = useParams()
  const { hasPermission } = useGradebookPermissions()
  const query = useStudentGradebook(studentId)

  if (!hasPermission('gradebook.view_student')) {
    return (
      <GradesErrorState message="You do not have permission to view this student gradebook." />
    )
  }

  if (query.isPending) {
    return <p className="text-sm text-ink-muted">Loading student gradebook…</p>
  }

  if (query.isError) {
    return (
      <GradesErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : 'Student gradebook unavailable'
        }
        onRetry={() => void query.refetch()}
      />
    )
  }

  const { student, overview } = query.data

  return (
    <div>
      <p className="mb-3">
        <Link
          to="/grades"
          className="text-sm font-medium text-ink-muted underline"
        >
          ← Grades
        </Link>
      </p>

      <div
        role="status"
        className="mb-4 rounded-card border border-status-warning-bg bg-status-warning-bg px-3 py-2 text-sm text-status-warning"
      >
        Viewing another student&apos;s grades (administrative view).
      </div>

      <header className="mb-4">
        <h1 className="text-title font-semibold text-ink">
          Viewing: {student.name}
        </h1>
        {student.committee ? (
          <p className="mt-1 text-sm text-ink-muted">
            Committee: {student.committee.name}
          </p>
        ) : null}
      </header>

      <div className="space-y-4">
        <GradeSummary summary={overview.summary} />
        {overview.entries.length === 0 ? (
          <EmptyGradesState />
        ) : (
          <GradeTable
            entries={overview.entries}
            caption={`Assignments for ${student.name}`}
          />
        )}
      </div>
    </div>
  )
}
