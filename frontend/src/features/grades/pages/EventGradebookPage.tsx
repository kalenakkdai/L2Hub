import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GradeStatusIndicator } from '../components/GradeStatusIndicator'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import {
  gradebookKeys,
  useEventGradebook,
  useGradebookCommands,
  useGradebookPermissions,
} from '../hooks/useGradebook'
import { formatScore } from '../utils/format'
import type { GradeStatus } from '../types'

type EventFilter = 'all' | 'submitted' | 'missing' | 'absent' | 'late'

const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'
const field =
  'w-20 rounded-control border border-border-subtle bg-surface px-2 py-1 text-sm tabular-nums text-ink'

export function EventGradebookPage() {
  const { eventId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('status') as EventFilter) || 'all'
  const { hasPermission } = useGradebookPermissions()
  const commands = useGradebookCommands()
  const queryClient = useQueryClient()
  const query = useEventGradebook(eventId)

  const canMassGrade =
    hasPermission('gradebook.grade') && Boolean(commands?.bulkUpdateGrades)
  const canPublish =
    hasPermission('gradebook.publish') && Boolean(commands?.publishGrades)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [massScore, setMassScore] = useState('')

  const bulkMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.bulkUpdateGrades) throw new Error('Mass grade unavailable')
      const score = Number(massScore)
      if (!Number.isFinite(score)) throw new Error('Enter a valid score')
      return commands.bulkUpdateGrades(
        [...selected].map((entryId) => ({
          entryId,
          score,
          status: 'graded' as const,
        })),
      )
    },
    onSuccess: async () => {
      setSelected(new Set())
      setMassScore('')
      await queryClient.invalidateQueries({
        queryKey: gradebookKeys.event(eventId),
      })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.publishGrades) throw new Error('Publish unavailable')
      return commands.publishGrades([...selected])
    },
    onSuccess: async () => {
      setSelected(new Set())
      await queryClient.invalidateQueries({
        queryKey: gradebookKeys.event(eventId),
      })
    },
  })

  const rows = useMemo(() => {
    const data = query.data
    if (!data) return []
    return data.rows.filter((row) => {
      if (filter === 'all') return true
      if (filter === 'absent') return Boolean(row.isAbsent)
      if (filter === 'submitted') {
        return row.status === 'submitted' || row.status === 'graded'
      }
      return row.status === (filter as GradeStatus)
    })
  }, [query.data, filter])

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
  const filters: EventFilter[] = ['all', 'submitted', 'missing', 'absent', 'late']
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.entryId))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map((row) => row.entryId)))
  }

  const toggleOne = (entryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

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

      {canMassGrade || canPublish ? (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-card border border-border-subtle bg-surface-sunken px-3 py-2">
          <p className="mr-auto text-xs text-ink-subtle">
            Mass grading · {selected.size} selected
          </p>
          {canMassGrade ? (
            <>
              <label className="text-xs text-ink-muted">
                Score
                <input
                  className={`${field} ml-2`}
                  type="number"
                  min={0}
                  value={massScore}
                  onChange={(e) => setMassScore(e.target.value)}
                  aria-label="Mass grade score"
                />
              </label>
              <button
                type="button"
                className={barButton}
                disabled={
                  selected.size === 0 ||
                  massScore === '' ||
                  bulkMutation.isPending
                }
                onClick={() => bulkMutation.mutate()}
              >
                Apply to selected
              </button>
            </>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className={barButton}
              disabled={selected.size === 0 || publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              Publish selected
            </button>
          ) : null}
        </div>
      ) : null}

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
                {canMassGrade || canPublish ? (
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all students"
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Student
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                  Committee
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
                  {canMassGrade || canPublish ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.entryId)}
                        onChange={() => toggleOne(row.entryId)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    </td>
                  ) : null}
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
