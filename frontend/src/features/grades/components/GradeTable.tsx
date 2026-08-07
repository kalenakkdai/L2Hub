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
    <div className="bg-white md:overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left md:min-w-[850px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden border-y border-slate-300 bg-white md:table-header-group">
          <tr>
            <th
              scope="col"
              className="w-[26%] px-1 py-2 text-[11px] font-semibold text-slate-700"
              aria-sort={sort === 'title' ? 'ascending' : 'none'}
            >
              ↕ Name
            </th>
            <th
              scope="col"
              className="w-[15%] px-2 py-2 text-[11px] font-semibold text-slate-700"
              aria-sort={sort === 'status' ? 'ascending' : 'none'}
            >
              ↕ Status
            </th>
            <th
              scope="col"
              className="w-[9%] px-2 py-2 text-[11px] font-semibold text-slate-700"
              aria-sort={sort === 'score' ? 'descending' : 'none'}
            >
              Score
            </th>
            <th
              scope="col"
              className="w-[16%] px-2 py-2 text-[11px] font-semibold text-slate-700"
            >
              Released
            </th>
            <th
              scope="col"
              className="w-[34%] px-2 py-2 text-right text-[11px] font-semibold text-slate-700"
              aria-sort={
                sort === 'dueAt' || sort === 'default' ? 'ascending' : 'none'
              }
            >
              Due ↕
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
