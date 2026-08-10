import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { useGradebookContext } from '../context/GradebookProvider'
import {
  useGradebookCommands,
  useGradebookPermissions,
} from '../hooks/useGradebook'

const field =
  'w-20 rounded-control border border-border-subtle bg-surface px-2 py-1 text-sm tabular-nums text-ink'
const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

/**
 * Heads enter class-wide scores in the separate Committee grades category.
 * Individual assignment grading stays with Jan and Jadon.
 */
export function CommitteeGradeEntryPage() {
  const { dataProvider } = useGradebookContext()
  const { hasPermission } = useGradebookPermissions()
  const commands = useGradebookCommands()
  const queryClient = useQueryClient()

  const canEnter =
    hasPermission('gradebook.grade_committee') &&
    Boolean(commands?.submitCommitteeGrades)

  const rosterQuery = useQuery({
    queryKey: ['gradebook', 'committee-grades'],
    queryFn: async () => {
      if (!dataProvider.getCommitteeGradeRoster) {
        throw new Error('Committee grade roster unavailable')
      }
      return dataProvider.getCommitteeGradeRoster()
    },
    enabled: canEnter || hasPermission('gradebook.view_event'),
  })

  const [scores, setScores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!rosterQuery.data) return
    const next: Record<string, string> = {}
    for (const row of rosterQuery.data.rows) {
      next[row.studentId] =
        typeof row.score === 'number' ? String(row.score) : ''
    }
    setScores(next)
  }, [rosterQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.submitCommitteeGrades || !rosterQuery.data) {
        throw new Error('Save unavailable')
      }
      const payload = Object.entries(scores)
        .map(([studentId, value]) => ({
          studentId,
          score: Number(value),
        }))
        .filter((row) => Number.isFinite(row.score))
      return commands.submitCommitteeGrades({
        committeeId: rosterQuery.data.committeeId,
        assignmentTitle: rosterQuery.data.assignmentTitle,
        pointsPossible: rosterQuery.data.pointsPossible,
        scores: payload,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['gradebook', 'committee-grades'],
      })
      await queryClient.invalidateQueries({ queryKey: ['gradebook', 'me'] })
    },
  })

  if (!canEnter && !hasPermission('gradebook.view_event')) {
    return (
      <GradesErrorState message="You do not have permission to enter committee grades." />
    )
  }

  if (rosterQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading class roster…</p>
  }

  if (rosterQuery.isError || !rosterQuery.data) {
    return (
      <GradesErrorState
        message="Committee grade roster unavailable."
        onRetry={() => void rosterQuery.refetch()}
      />
    )
  }

  const roster = rosterQuery.data

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canEnter) return
    saveMutation.mutate()
  }

  return (
    <div className="space-y-4">
      <p>
        <Link
          to="/grades"
          className="text-sm font-medium text-ink-muted underline"
        >
          ← Grades
        </Link>
      </p>
      <header>
        <h1 className="text-title font-semibold text-ink">
          {roster.assignmentTitle}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {roster.committeeName} · Committee grades category ·{' '}
          {roster.pointsPossible} pts possible
        </p>
        <p className="mt-2 text-xs text-ink-subtle">
          Class-wide scores for this committee go here — separate from
          individual assignment grading (Jan / Jadon only).
        </p>
      </header>

      {roster.rows.length === 0 ? (
        <EmptyGradesState title="No students in this roster." />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border-subtle bg-surface-sunken">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                    Student
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase text-ink-subtle">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.rows.map((row) => (
                  <tr
                    key={row.studentId}
                    className="border-b border-border-subtle"
                  >
                    <td className="px-3 py-2 font-medium text-ink">
                      {row.studentName}
                    </td>
                    <td className="px-3 py-2">
                      {canEnter ? (
                        <input
                          className={field}
                          type="number"
                          min={0}
                          max={roster.pointsPossible}
                          step={0.5}
                          value={scores[row.studentId] ?? ''}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [row.studentId]: e.target.value,
                            }))
                          }
                          aria-label={`Score for ${row.studentName}`}
                        />
                      ) : (
                        <span className="tabular-nums text-ink">
                          {row.score ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEnter ? (
            <button
              type="submit"
              className={barButton}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : 'Save committee grades for class'}
            </button>
          ) : null}
          {saveMutation.isSuccess ? (
            <p className="text-xs text-ink-subtle" role="status">
              Saved — waiting for Jan or Jadon to publish.
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
