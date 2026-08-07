import { Link } from 'react-router-dom'
import type { GradebookEntry } from '../types'
import { formatDateTime, formatScore } from '../utils/format'

export interface GradeTableRowProps {
  entry: GradebookEntry
  assignmentHref: (assignmentId: string) => string
}

export function GradeTableRow({ entry, assignmentHref }: GradeTableRowProps) {
  const href = assignmentHref(entry.assignmentId)

  return (
    <>
      {/* Desktop row */}
      <tr className="group hidden border-b border-border-subtle last:border-b-0 hover:bg-surface-sunken md:table-row">
        <th scope="row" className="px-4 py-3 text-left align-middle font-normal">
          <Link
            to={href}
            className="text-sm font-medium text-status-info hover:underline"
          >
            {entry.assignmentTitle}
          </Link>
          <p className="mt-1 text-[11px] text-ink-subtle">
            {entry.event?.name ?? entry.assignmentType.replaceAll('_', ' ')}
          </p>
        </th>
        <td className="px-3 py-3 align-middle text-xs text-ink-muted">
          {entry.availableAt ? formatDateTime(entry.availableAt) : '—'}
        </td>
        <td className="px-3 py-3 align-middle text-xs text-ink-muted">
          {entry.dueAt ? formatDateTime(entry.dueAt) : 'No due date'}
          {entry.lateDueAt ? (
            <span className="mt-0.5 block text-[11px] text-ink-subtle">
              Late due {formatDateTime(entry.lateDueAt)}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right align-middle text-sm font-medium tabular-nums text-ink">
          {formatScore(entry.score, entry.pointsPossible)}
        </td>
      </tr>

      {/* Mobile compact record */}
      <tr className="border-b border-border-subtle md:hidden">
        <td colSpan={4} className="px-3 py-3">
          <Link to={href} className="block rounded-control">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {entry.assignmentTitle}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">
                  Due {formatDateTime(entry.dueAt)}
                  {entry.event?.name ? ` · ${entry.event.name}` : ''}
                </p>
                {entry.lateDueAt ? (
                  <p className="mt-0.5 text-[11px] text-status-warning">
                    Late due {formatDateTime(entry.lateDueAt)}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatScore(entry.score, entry.pointsPossible)}
              </span>
            </div>
          </Link>
        </td>
      </tr>
    </>
  )
}
