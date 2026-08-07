import type { GradebookEntry, GradebookSortField } from '../types'
import { GradeTableRow } from './GradeTableRow'
import { sortGradebookEntries } from '../utils/format'

export interface GradeTableProps {
  entries: GradebookEntry[]
  sort?: GradebookSortField
  assignmentHref?: (assignmentId: string) => string
  caption?: string
}

export function GradeTable({
  entries,
  sort = 'default',
  assignmentHref = (id) => `/grades/${id}`,
  caption = 'Your gradebook assignments',
}: GradeTableProps) {
  const sorted = sortGradebookEntries(entries, sort)

  if (sorted.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs md:overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left md:min-w-[700px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden border-b border-border-strong bg-surface-sunken md:table-header-group">
          <tr>
            <th
              scope="col"
              className="w-[40%] px-4 py-3 text-xs font-semibold text-ink-muted"
              aria-sort={sort === 'title' ? 'ascending' : 'none'}
            >
              Name
            </th>
            <th
              scope="col"
              className="w-[20%] px-3 py-3 text-xs font-semibold text-ink-muted"
            >
              Released
            </th>
            <th
              scope="col"
              className="w-[20%] px-3 py-3 text-xs font-semibold text-ink-muted"
              aria-sort={
                sort === 'dueAt' || sort === 'default' ? 'ascending' : 'none'
              }
            >
              Due
            </th>
            <th
              scope="col"
              className="w-[20%] px-4 py-3 text-right text-xs font-semibold text-ink-muted"
              aria-sort={sort === 'score' ? 'descending' : 'none'}
            >
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <GradeTableRow
              key={entry.id}
              entry={entry}
              assignmentHref={assignmentHref}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
