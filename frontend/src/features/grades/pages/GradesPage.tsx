import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { GradeFilters } from '../components/GradeFilters'
import { GradeSummary } from '../components/GradeSummary'
import { GradeTable } from '../components/GradeTable'
import { GradeTrend } from '../components/GradeTrend'
import { GradesTabs } from '../components/GradesTabs'
import { TheoreticalGradesPanel } from '../components/TheoreticalGradesPanel'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { useGradebook } from '../hooks/useGradebook'
import { useGradebookContext } from '../context/GradebookProvider'
import type { GradebookFilters, GradebookSortField, GradebookTab } from '../types'
import {
  countEntriesByTab,
  filterEntriesByTab,
  parseGradebookTab,
} from '../utils/tabs'

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

  const tabEntries = useMemo(
    () =>
      filterEntriesByTab(gradebookQuery.data?.entries ?? [], tab),
    [gradebookQuery.data?.entries, tab],
  )

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
            Your assignments, submissions, and completion history.
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
      </header>

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

          <GradeFilters
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={(value) => updateParam('sort', value)}
          />

          <div
            role="tabpanel"
            id={`grades-panel-${tab}`}
            aria-labelledby={`grades-tab-${tab}`}
          >
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

          <GradeTrend entries={gradebookQuery.data.entries} />

          <TheoreticalGradesPanel
            entries={gradebookQuery.data.entries}
            categories={gradebookQuery.data.categories ?? []}
            actualWeightedPercent={
              gradebookQuery.data.summary.weightedPercent ?? null
            }
          />
        </div>
      ) : null}
    </div>
  )
}
