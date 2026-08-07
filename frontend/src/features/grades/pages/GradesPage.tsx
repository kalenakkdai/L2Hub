import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { GradeFilters, type GradeFilterStatus } from '../components/GradeFilters'
import { GradeSummary } from '../components/GradeSummary'
import { GradeTable } from '../components/GradeTable'
import {
  EmptyGradesState,
  GradesErrorState,
} from '../components/EmptyGradesState'
import { useGradebook } from '../hooks/useGradebook'
import { useGradebookContext } from '../context/GradebookProvider'
import type { GradebookFilters, GradebookSortField } from '../types'

function parseStatus(value: string | null): GradeFilterStatus {
  const allowed: GradeFilterStatus[] = [
    'all',
    'open',
    'submitted',
    'graded',
    'missing',
    'upcoming',
    'not_started',
    'draft',
    'late',
    'excused',
    'closed',
  ]
  if (value && allowed.includes(value as GradeFilterStatus)) {
    return value as GradeFilterStatus
  }
  return 'all'
}

function parseSort(value: string | null): GradebookSortField {
  const allowed: GradebookSortField[] = [
    'default',
    'dueAt',
    'newest',
    'oldest',
    'title',
    'status',
    'score',
  ]
  if (value && allowed.includes(value as GradebookSortField)) {
    return value as GradebookSortField
  }
  return 'default'
}

export function GradesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get('status'))
  const sort = parseSort(searchParams.get('sort'))
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
    if (status !== 'all') next.status = status
    if (urlQuery.trim()) next.query = urlQuery.trim()
    return next
  }, [status, urlQuery])

  const gradebookQuery = useGradebook(filters)
  const userQuery = useQuery({
    queryKey: ['gradebook', 'current-user'],
    queryFn: () => authProvider.getCurrentUser(),
  })

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (
      !value ||
      (key === 'status' && value === 'all') ||
      (key === 'sort' && value === 'default')
    ) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <main className="w-full px-4 py-5 sm:px-6 lg:px-7">
      <header className="mb-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Grades
          </h1>
          <span className="mt-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <p className="mt-1 text-sm text-slate-600">Leadership 2 · 2026–27</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-slate-500">
            Your assignments, submissions, and completion history.
          </p>
          {userQuery.data ? (
            <p className="text-xs text-slate-400">
              {userQuery.data.name}
              {userQuery.data.committeeName
                ? ` · ${userQuery.data.committeeName}`
                : ''}
            </p>
          ) : null}
        </div>
      </header>

      {gradebookQuery.isPending ? (
        <p className="text-sm text-slate-500" role="status">
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

          <GradeFilters
            status={status}
            query={query}
            sort={sort}
            onStatusChange={(value) => updateParam('status', value)}
            onQueryChange={setQuery}
            onSortChange={(value) => updateParam('sort', value)}
          />

          {gradebookQuery.data.entries.length === 0 ? (
            <EmptyGradesState
              title={
                status === 'missing'
                  ? "You're caught up. No missing assignments."
                  : 'No gradebook assignments yet.'
              }
            />
          ) : (
            <GradeTable entries={gradebookQuery.data.entries} sort={sort} />
          )}
        </div>
      ) : null}
    </main>
  )
}
