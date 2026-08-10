import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { GradeFilters } from '../components/GradeFilters'
import { GradeSummary } from '../components/GradeSummary'
import { GradeTable } from '../components/GradeTable'
import { GradeTrend } from '../components/GradeTrend'
import { GradesTabs } from '../components/GradesTabs'
import { SyllabusPanel } from '../components/SyllabusPanel'
import { TheoreticalGradesPanel } from '../components/TheoreticalGradesPanel'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { fetchGradeAssignments } from '../api/fastapiGradebookAdapter'
import {
  gradebookKeys,
  useGradebook,
  useGradebookCommands,
} from '../hooks/useGradebook'
import { useGradebookContext } from '../context/GradebookProvider'
import type { GradebookFilters, GradebookSortField, GradebookTab } from '../types'
import {
  countEntriesByTab,
  filterEntriesByTab,
  isAssignmentGradebookTab,
  parseGradebookTab,
} from '../utils/tabs'

const CATEGORY_OPTIONS = [
  { id: 'cat-debriefs', label: 'Event debriefs' },
  { id: 'cat-reflections', label: 'Reflections' },
  { id: 'cat-deliverables', label: 'Deliverables' },
  { id: 'cat-participation', label: 'Participation' },
  { id: 'cat-committee-grades', label: 'Committee grades' },
]

function parseSort(value: string | null): GradebookSortField {
  const allowed: GradebookSortField[] = [
    'default',
    'dueAt',
    'newest',
    'oldest',
    'title',
    'score',
  ]
  if (value && allowed.includes(value as GradebookSortField)) {
    return value as GradebookSortField
  }
  return 'default'
}

function OperatorCreatePanel() {
  const commands = useGradebookCommands()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('cat-debriefs')
  const [pointsPossible, setPointsPossible] = useState('20')
  const [createdId, setCreatedId] = useState<string | null>(null)

  const assignmentsQuery = useQuery({
    queryKey: ['gradebook', 'assignments'],
    queryFn: fetchGradeAssignments,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!commands?.createAssignment) {
        throw new Error('Create assignment unavailable')
      }
      return commands.createAssignment({
        title: title.trim(),
        categoryId,
        pointsPossible: Number(pointsPossible) || 10,
        assignmentType: 'custom',
      })
    },
    onSuccess: async (assignment) => {
      setCreatedId(assignment.id)
      setTitle('')
      await queryClient.invalidateQueries({ queryKey: gradebookKeys.me() })
      await queryClient.invalidateQueries({
        queryKey: ['gradebook', 'assignments'],
      })
    },
  })

  if (!commands?.createAssignment) return null

  return (
    <section className="mb-4 rounded-card border border-border-subtle bg-surface-sunken p-4">
      <h2 className="text-sm font-semibold text-ink">Create assignment</h2>
      <p className="mt-1 text-xs text-ink-subtle">
        Jan / Jadon only. Enrolls every active camper, then open the roster to
        score and publish.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!title.trim()) return
          createMutation.mutate()
        }}
      >
        <label className="min-w-[12rem] flex-1 text-xs text-ink-muted">
          Title
          <input
            className="mt-1 w-full rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-ink"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label className="text-xs text-ink-muted">
          Category
          <select
            className="mt-1 block rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-ink"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-24 text-xs text-ink-muted">
          Points
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-ink"
            value={pointsPossible}
            onChange={(event) => setPointsPossible(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending || !title.trim()}
          className="rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating…' : 'Create'}
        </button>
      </form>
      {createMutation.isError ? (
        <p className="mt-2 text-xs text-status-danger" role="alert">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : 'Could not create assignment.'}
        </p>
      ) : null}
      {createdId ? (
        <p className="mt-2 text-xs text-ink-muted">
          Created.{' '}
          <Link
            to={`/grades/events/${createdId}`}
            className="font-medium text-accent-ink underline-offset-2 hover:underline"
          >
            Open roster to grade
          </Link>
        </p>
      ) : null}
      {(assignmentsQuery.data?.length ?? 0) > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border-divider pt-3">
          {assignmentsQuery.data!.map((assignment) => (
            <li key={assignment.id} className="text-xs text-ink">
              <Link
                to={`/grades/events/${assignment.id}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                {assignment.title}
              </Link>
              <span className="text-ink-subtle">
                {' '}
                · {assignment.pointsPossible} pts · mass grade
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function GradesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = parseSort(searchParams.get('sort'))
  const tab = parseGradebookTab(searchParams.get('tab'))
  const urlQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const { authProvider } = useGradebookContext()

  useEffect(() => {
    setQuery(urlQuery)
  }, [urlQuery])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (!query.trim()) next.delete('q')
      else next.set('q', query.trim())
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true })
      }
    }, 150)
    return () => window.clearTimeout(handle)
  }, [query, searchParams, setSearchParams])

  const filters: GradebookFilters = useMemo(() => {
    const next: GradebookFilters = {}
    if (urlQuery.trim()) next.query = urlQuery.trim()
    return next
  }, [urlQuery])

  const gradebookQuery = useGradebook(filters)
  const userQuery = useQuery({
    queryKey: ['gradebook', 'current-user'],
    queryFn: () => authProvider.getCurrentUser(),
  })

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (
      !value ||
      (key === 'sort' && value === 'default') ||
      (key === 'tab' && value === 'upcoming')
    ) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  const tabCounts = useMemo(
    () => countEntriesByTab(gradebookQuery.data?.entries ?? []),
    [gradebookQuery.data?.entries],
  )

  const tabEntries = useMemo(() => {
    if (!isAssignmentGradebookTab(tab)) return []
    return filterEntriesByTab(gradebookQuery.data?.entries ?? [], tab)
  }, [gradebookQuery.data?.entries, tab])

  const canAssign = authProvider.hasPermission('gradebook.assign')

  return (
    <div>
      <header className="mb-4 border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
          <h1 className="text-display font-semibold text-ink">Grades</h1>
          <span className="mt-1 hidden h-6 w-px bg-border-subtle sm:block" />
          <p className="mt-1 text-sm text-ink-muted">Leadership 2 · 2026–27</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-ink-subtle">
            Your assignments, submissions, completion history, and syllabus.
          </p>
          {userQuery.data ? (
            <p className="text-xs text-ink-subtle">
              {userQuery.data.name}
              {userQuery.data.committeeName
                ? ` · ${userQuery.data.committeeName}`
                : ''}
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {authProvider.hasPermission('gradebook.request_assignment') ||
          canAssign ? (
            <Link
              to="/grades/requests"
              className="text-xs font-medium text-ink underline-offset-2 hover:underline"
            >
              Assignment requests
            </Link>
          ) : null}
          {authProvider.hasPermission('gradebook.grade_committee') ? (
            <Link
              to="/grades/committee"
              className="text-xs font-medium text-ink underline-offset-2 hover:underline"
            >
              Committee grades
            </Link>
          ) : null}
        </div>
      </header>

      {canAssign && userQuery.isSuccess ? <OperatorCreatePanel /> : null}

      {gradebookQuery.isPending ? (
        <p className="text-sm text-ink-muted" role="status">
          Loading grades…
        </p>
      ) : null}

      {gradebookQuery.isError ? (
        <GradesErrorState
          message={
            gradebookQuery.error instanceof Error
              ? gradebookQuery.error.message
              : "We couldn't load your grades."
          }
          onRetry={() => void gradebookQuery.refetch()}
        />
      ) : null}

      {gradebookQuery.isSuccess ? (
        <div className="space-y-3">
          <GradeSummary summary={gradebookQuery.data.summary} />

          <GradesTabs
            active={tab}
            counts={tabCounts}
            onChange={(nextTab: GradebookTab) => updateParam('tab', nextTab)}
          />

          <div
            role="tabpanel"
            id={`grades-panel-${tab}`}
            aria-labelledby={`grades-tab-${tab}`}
          >
            {tab === 'syllabus' ? (
              <SyllabusPanel />
            ) : (
              <div className="space-y-3">
                <GradeFilters
                  query={query}
                  sort={sort}
                  onQueryChange={setQuery}
                  onSortChange={(value) => updateParam('sort', value)}
                />

                {gradebookQuery.data.entries.length === 0 ? (
                  <EmptyGradesState title="No gradebook assignments yet." />
                ) : tabEntries.length === 0 ? (
                  <EmptyGradesState
                    title={
                      urlQuery.trim()
                        ? 'No assignments match your search in this tab.'
                        : tab === 'upcoming'
                          ? 'No upcoming assignments.'
                          : tab === 'missing'
                            ? 'No missing assignments.'
                            : 'No completed assignments yet.'
                    }
                  />
                ) : (
                  <GradeTable
                    entries={tabEntries}
                    sort={sort}
                    categories={gradebookQuery.data.categories}
                  />
                )}
              </div>
            )}
          </div>

          {tab !== 'syllabus' ? (
            <>
              <GradeTrend entries={gradebookQuery.data.entries} />

              <TheoreticalGradesPanel
                entries={gradebookQuery.data.entries}
                categories={gradebookQuery.data.categories ?? []}
                actualWeightedPercent={
                  gradebookQuery.data.summary.weightedPercent ?? null
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
