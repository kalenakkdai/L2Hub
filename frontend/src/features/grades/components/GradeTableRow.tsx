import { Link } from 'react-router-dom'
import type { GradebookEntry } from '../types'
import { GradeStatusIndicator } from './GradeStatusIndicator'
import {
  availableSubmittedLabel,
  formatDateTime,
  formatScore,
} from '../utils/format'

export interface GradeTableRowProps {
  entry: GradebookEntry
  assignmentHref: (assignmentId: string) => string
}

function getDeadlineMetrics(entry: GradebookEntry) {
  if (!entry.availableAt || !entry.dueAt) {
    return { normalWindowPercent: 100, submittedPercent: null }
  }

  const opened = new Date(entry.availableAt).getTime()
  const due = new Date(entry.dueAt).getTime()
  const lateDue = entry.lateDueAt
    ? new Date(entry.lateDueAt).getTime()
    : due
  const submitted = entry.submittedAt
    ? new Date(entry.submittedAt).getTime()
    : null

  if (
    !Number.isFinite(opened) ||
    !Number.isFinite(due) ||
    !Number.isFinite(lateDue) ||
    lateDue <= opened
  ) {
    return { normalWindowPercent: 100, submittedPercent: null }
  }

  const totalWindow = lateDue - opened
  const normalWindowPercent = Math.min(
    100,
    Math.max(0, ((due - opened) / totalWindow) * 100),
  )
  const submittedPercent =
    submitted === null || !Number.isFinite(submitted)
      ? null
      : Math.min(100, Math.max(0, ((submitted - opened) / totalWindow) * 100))

  return { normalWindowPercent, submittedPercent }
}

function DeadlineWindow({ entry }: { entry: GradebookEntry }) {
  if (!entry.dueAt) {
    return <span className="text-xs text-slate-400">No due date</span>
  }

  const { normalWindowPercent, submittedPercent } = getDeadlineMetrics(entry)

  return (
    <div className="min-w-56">
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] leading-tight">
        <span className="text-slate-500">
          {entry.acceptingLateSubmissions
            ? 'Accepting late submissions'
            : entry.submittedAt
              ? availableSubmittedLabel(entry)
              : 'Submission window'}
        </span>
        <span className="shrink-0 font-medium text-slate-700">
          Due {formatDateTime(entry.dueAt)}
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-amber-100">
        <span
          className="absolute inset-y-0 left-0 bg-slate-200"
          style={{ width: `${normalWindowPercent}%` }}
          aria-hidden="true"
        />
        {submittedPercent !== null ? (
          <span
            className={
              entry.isLate
                ? 'absolute inset-y-0 left-0 bg-amber-500'
                : 'absolute inset-y-0 left-0 bg-sky-600'
            }
            style={{ width: `${submittedPercent}%` }}
            aria-hidden="true"
          />
        ) : null}
        <span
          className="absolute inset-y-0 w-px bg-slate-500"
          style={{ left: `${normalWindowPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 flex items-start justify-between gap-3 text-[10px] leading-tight text-slate-500">
        <span>
          {entry.availableAt
            ? `Released ${formatDateTime(entry.availableAt)}`
            : 'Available'}
        </span>
        {entry.lateDueAt ? (
          <span className="text-right">
            Late due {formatDateTime(entry.lateDueAt)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function GradeTableRow({ entry, assignmentHref }: GradeTableRowProps) {
  const href = assignmentHref(entry.assignmentId)

  return (
    <>
      {/* Desktop row */}
      <tr className="group hidden border-b border-slate-200 hover:bg-sky-50/40 md:table-row">
        <th scope="row" className="px-1 py-2.5 text-left align-top font-normal">
          <Link
            to={href}
            className="text-[13px] font-semibold text-slate-900 underline decoration-slate-400 underline-offset-2 group-hover:decoration-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            {entry.assignmentTitle}
          </Link>
          <p className="mt-1 text-[11px] text-slate-500">
            {entry.event?.name ?? entry.assignmentType.replaceAll('_', ' ')}
          </p>
        </th>
        <td className="px-2 py-2.5 align-top text-xs">
          <GradeStatusIndicator status={entry.status} />
          {entry.submittedAt ? (
            <p className="mt-1 pl-5 text-[10px] text-slate-500">
              {entry.isLate ? 'Submitted late' : 'Submitted'}
            </p>
          ) : null}
        </td>
        <td className="px-2 py-2.5 align-top text-xs font-medium tabular-nums text-slate-800">
          {formatScore(entry.score, entry.pointsPossible)}
        </td>
        <td className="px-2 py-2.5 align-top text-[11px] text-slate-600">
          {entry.availableAt ? formatDateTime(entry.availableAt) : '—'}
        </td>
        <td className="px-2 py-2.5 align-top">
          <DeadlineWindow entry={entry} />
        </td>
      </tr>

      {/* Mobile compact record */}
      <tr className="border-b border-slate-200 md:hidden">
        <td colSpan={5} className="px-1 py-3">
          <Link
            to={href}
            className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {entry.assignmentTitle}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <GradeStatusIndicator status={entry.status} />
                  <span className="tabular-nums font-medium text-slate-800">
                    {formatScore(entry.score, entry.pointsPossible)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Due {formatDateTime(entry.dueAt)}
                  {entry.event?.name ? ` · ${entry.event.name}` : ''}
                </p>
                {entry.lateDueAt ? (
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Late due {formatDateTime(entry.lateDueAt)}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-medium text-slate-600">
                Open →
              </span>
            </div>
          </Link>
        </td>
      </tr>
    </>
  )
}
