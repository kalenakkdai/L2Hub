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
      <GradesErrorState message="You do not have permission to view this event gradebook." />
    )
  }

  if (query.isPending) {
    return <p className="text-sm text-ink-muted">Loading event gradebook…</p>
  }

  if (query.isError) {
    return (
      <GradesErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : 'Event gradebook unavailable'
        }
        onRetry={() => void query.refetch()}
      />
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
    <div>
      <p className="mb-3">
        <Link
          to="/grades"
          className="text-sm font-medium text-ink-muted underline"
        >
          ← Grades
        </Link>
      </p>
      <header className="mb-4">
        <h1 className="text-title font-semibold text-ink">
          {data.assignmentTitle}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {data.event.name} · Completion {data.completionCompleted} /{' '}
          {data.completionTotal}
        </p>
      </header>

      <div
        className="mb-3 flex flex-wrap gap-1"
        role="tablist"
        aria-label="Filter roster"
      >
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`rounded-control px-2.5 py-1.5 text-sm font-medium capitalize ${
              filter === value
                ? 'bg-navy-900 text-white'
                : 'bg-surface-sunken text-ink-muted'
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
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Event gradebook for {data.assignmentTitle}
            </caption>
            <thead className="border-b border-border-subtle bg-surface-sunken">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Student
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Crew
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Status
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entryId} className="border-b border-border-subtle">
                  <td className="px-3 py-2">
                    <Link
                      to={`/grades/students/${row.studentId}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink-muted">
                    {row.committee?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <GradeStatusIndicator status={row.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink">
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
    </div>
  )
}
