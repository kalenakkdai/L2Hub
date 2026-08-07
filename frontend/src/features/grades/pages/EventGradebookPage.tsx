import { Link, useParams, useSearchParams } from 'react-router-dom'
import { GradeStatusIndicator } from '../components/GradeStatusIndicator'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { useEventGradebook, useGradebookPermissions } from '../hooks/useGradebook'
import { formatScore } from '../utils/format'
import type { GradeStatus } from '../types'

type EventFilter = 'all' | 'submitted' | 'missing' | 'absent' | 'late'

export function EventGradebookPage() {
  const { eventId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('status') as EventFilter) || 'all'
  const { hasPermission } = useGradebookPermissions()
  const query = useEventGradebook(eventId)

  if (!hasPermission('gradebook.view_event')) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <GradesErrorState message="You do not have permission to view this event gradebook." />
      </main>
    )
  }

  if (query.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-slate-500">Loading event gradebook…</p>
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
              : 'Event gradebook unavailable'
          }
          onRetry={() => void query.refetch()}
        />
      </main>
    )
  }

  const data = query.data
  const rows = data.rows.filter((row) => {
    if (filter === 'all') return true
    if (filter === 'absent') return Boolean(row.isAbsent)
    if (filter === 'submitted') {
      return row.status === 'submitted' || row.status === 'graded'
    }
    return row.status === (filter as GradeStatus)
  })

  const filters: EventFilter[] = ['all', 'submitted', 'missing', 'absent', 'late']

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-3">
        <Link to="/grades" className="text-sm font-medium text-slate-600 underline">
          ← Grades
        </Link>
      </p>
      <header className="mb-4">
        <h1 className="text-[1.5rem] font-semibold text-slate-900">
          {data.assignmentTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.event.name} · Completion {data.completionCompleted} /{' '}
          {data.completionTotal}
        </p>
      </header>

      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Filter roster">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`rounded px-2.5 py-1.5 text-sm font-medium capitalize ${
              filter === value
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              if (value === 'all') next.delete('status')
              else next.set('status', value)
              setSearchParams(next, { replace: true })
            }}
          >
            {value}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyGradesState title="No students match this filter." />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Event gradebook for {data.assignmentTitle}
            </caption>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                  Student
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                  Committee
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entryId} className="border-b border-slate-200">
                  <td className="px-3 py-2">
                    <Link
                      to={`/grades/students/${row.studentId}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.committee?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <GradeStatusIndicator status={row.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-800">
                    {row.status === 'excused'
                      ? 'Excused'
                      : formatScore(row.score, row.pointsPossible)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
