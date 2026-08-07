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
      <main className="mx-auto max-w-6xl px-4 py-6">
        <GradesErrorState message="You do not have permission to view this student gradebook." />
      </main>
    )
  }

  if (query.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-slate-500">Loading student gradebook…</p>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <GradesErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : 'Student gradebook unavailable'
          }
          onRetry={() => void query.refetch()}
        />
      </main>
    )
  }

  const { student, overview } = query.data

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-3">
        <Link to="/grades" className="text-sm font-medium text-slate-600 underline">
          ← Grades
        </Link>
      </p>

      <div
        role="status"
        className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        Viewing another student&apos;s grades (administrative view).
      </div>

      <header className="mb-4">
        <h1 className="text-[1.5rem] font-semibold text-slate-900">
          Viewing: {student.name}
        </h1>
        {student.committee ? (
          <p className="mt-1 text-sm text-slate-600">
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
    </main>
  )
}
