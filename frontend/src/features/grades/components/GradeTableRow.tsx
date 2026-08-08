import { Link } from 'react-router-dom'
import type { GradebookEntry } from '../types'
import { formatDateTime, formatScore } from '../utils/format'
import { GradeDistributionPanel } from './GradeDistributionPanel'

export interface GradeTableRowProps {
  entry: GradebookEntry
  assignmentHref: (assignmentId: string) => string
  categoryName?: string | null
}

export function GradeTableRow({
  entry,
  assignmentHref,
  categoryName = null,
}: GradeTableRowProps) {
  const href = assignmentHref(entry.assignmentId)
  const distribution = entry.distribution

  return (
    <>
      <tr className="group hidden border-b border-border-subtle last:border-b-0 hover:bg-surface-sunken md:table-row">
        <th scope="row" className="px-4 py-3 text-left align-top font-normal">
          <Link
            to={href}
            className="text-sm font-medium text-status-info hover:underline"
          >
            {entry.assignmentTitle}
          </Link>
          <p className="mt-1 text-[11px] text-ink-subtle">
            {entry.event?.name ?? entry.assignmentType.replaceAll('_', ' ')}
          </p>
          {distribution ? (
            <GradeDistributionPanel
              distribution={distribution}
              assignmentTitle={entry.assignmentTitle}
            />
          ) : null}
        </th>
        <td className="px-3 py-3 align-top text-xs text-ink-muted">
          {categoryName ?? '—'}
        </td>
        <td className="px-3 py-3 align-top text-xs text-ink-muted">
          {entry.availableAt ? formatDateTime(entry.availableAt) : '—'}
        </td>
        <td className="px-3 py-3 align-top text-xs text-ink-muted">
          {entry.dueAt ? formatDateTime(entry.dueAt) : 'No due date'}
          {entry.lateDueAt ? (
            <span className="mt-0.5 block text-[11px] text-ink-subtle">
              Late due {formatDateTime(entry.lateDueAt)}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right align-top text-sm font-medium tabular-nums text-ink">
          {formatScore(entry.score, entry.pointsPossible)}
        </td>
      </tr>

      <tr className="border-b border-border-subtle md:hidden">
        <td colSpan={5} className="px-3 py-3">
          <div className="rounded-control">
            <Link to={href} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {entry.assignmentTitle}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Due {formatDateTime(entry.dueAt)}
                    {entry.event?.name ? ` · ${entry.event.name}` : ''}
                    {categoryName ? ` · ${categoryName}` : ''}
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
            {distribution ? (
              <GradeDistributionPanel
                distribution={distribution}
                assignmentTitle={entry.assignmentTitle}
              />
            ) : null}
          </div>
        </td>
      </tr>
    </>
  )
}
