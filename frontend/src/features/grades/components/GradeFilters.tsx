import type { GradeStatus } from '../types'

export type GradeFilterStatus =
  | 'all'
  | 'open'
  | 'submitted'
  | 'graded'
  | 'missing'
  | 'upcoming'
  | GradeStatus

export interface GradeFiltersProps {
  status: GradeFilterStatus
  query: string
  sort: string
  onStatusChange: (status: GradeFilterStatus) => void
  onQueryChange: (query: string) => void
  onSortChange: (sort: string) => void
}

const STATUS_OPTIONS: Array<{ value: GradeFilterStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
  { value: 'missing', label: 'Missing' },
  { value: 'upcoming', label: 'Upcoming' },
]

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'dueAt', label: 'Due date' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Assignment name' },
  { value: 'status', label: 'Status' },
  { value: 'score', label: 'Score' },
]

export function GradeFilters({
  status,
  query,
  sort,
  onStatusChange,
  onQueryChange,
  onSortChange,
}: GradeFiltersProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
      <div
        role="tablist"
        aria-label="Filter assignments by status"
        className="flex flex-wrap gap-4"
      >
        {STATUS_OPTIONS.map((option) => {
          const selected = status === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`border-b-2 px-0.5 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                selected
                  ? 'border-sky-700 text-sky-800'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
              onClick={() => onStatusChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="grades-search">
          Search assignments
        </label>
        <input
          id="grades-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search assignments"
          className="w-full rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:w-48"
        />

        <label className="sr-only" htmlFor="grades-sort">
          Sort assignments
        </label>
        <select
          id="grades-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
