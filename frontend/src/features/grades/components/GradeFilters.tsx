export interface GradeFiltersProps {
  query: string
  sort: string
  onQueryChange: (query: string) => void
  onSortChange: (sort: string) => void
}

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'dueAt', label: 'Due date' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Assignment name' },
  { value: 'score', label: 'Score' },
]

export function GradeFilters({
  query,
  sort,
  onQueryChange,
  onSortChange,
}: GradeFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="grades-search">
          Search assignments
        </label>
        <input
          id="grades-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search assignments"
          className="w-full rounded-control border border-border-strong bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-ink-subtle sm:w-48"
        />

        <label className="sr-only" htmlFor="grades-sort">
          Sort assignments
        </label>
        <select
          id="grades-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-control border border-border-strong bg-surface px-2 py-1 text-xs text-ink"
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
