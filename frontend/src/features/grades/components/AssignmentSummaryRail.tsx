import type { ReactNode } from 'react'
import { Check, Info, X } from 'lucide-react'
import type { GradeAssignmentDetail } from '../types'
import { GradeStatusIndicator } from './GradeStatusIndicator'
import { formatDateTimeLong, formatScore } from '../utils/format'

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-slate-900">{value}</dd>
    </div>
  )
}

export interface AssignmentSummaryRailProps {
  detail: GradeAssignmentDetail
}

export function AssignmentSummaryRail({ detail }: AssignmentSummaryRailProps) {
  const { entry, submission, student, feedback } = detail
  const criteria = feedback?.items ?? []

  return (
    <aside
      aria-label="Assignment summary"
      className="border-slate-200 bg-slate-50 p-4 lg:h-full lg:border-l"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {entry.event?.name ?? 'Assignment'}
        </h2>
        <GradeStatusIndicator status={entry.status} />
      </div>

      <p className="mt-3 flex gap-2 rounded-sm bg-sky-100 px-3 py-2 text-[11px] leading-4 text-sky-950">
        <Info size={13} className="mt-px shrink-0" aria-hidden="true" />
        <span>
          Scores and completion are recorded by L2 Hub when your submission is
          received.
        </span>
      </p>

      <dl className="mt-4">
        <Field label="Student" value={student?.name} />
        <Field label="Assignment" value={entry.assignmentTitle} />
        <Field
          label="Total Points"
          value={
            typeof entry.pointsPossible === 'number'
              ? `${formatScore(entry.score, entry.pointsPossible)} pts`
              : null
          }
        />
        <Field
          label="Score"
          value={formatScore(entry.score, entry.pointsPossible)}
        />
        <Field
          label="Submitted"
          value={
            submission?.submittedAt
              ? formatDateTimeLong(submission.submittedAt)
              : entry.submittedAt
                ? formatDateTimeLong(entry.submittedAt)
                : null
          }
        />
        <Field label="Due" value={formatDateTimeLong(entry.dueAt)} />
        {entry.lateDueAt ? (
          <Field
            label="Late Due Date"
            value={formatDateTimeLong(entry.lateDueAt)}
          />
        ) : null}
        <Field
          label="Late"
          value={
            typeof entry.isLate === 'boolean'
              ? entry.isLate
                ? 'Yes'
                : 'No'
              : null
          }
        />
        <Field
          label="Attempt"
          value={submission?.attempt ? String(submission.attempt) : null}
        />
      </dl>

      {criteria.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-[11px] font-semibold text-slate-500">
            Completion Checks
          </p>
          <ul className="mt-2 space-y-1">
            {criteria.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-1.5 text-[11px] leading-4"
              >
                {item.passed === false ? (
                  <X
                    size={11}
                    className="mt-0.5 shrink-0 text-red-700"
                    aria-hidden="true"
                  />
                ) : (
                  <Check
                    size={11}
                    className="mt-0.5 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    item.passed === false ? 'text-red-800' : 'text-emerald-800'
                  }
                >
                  {item.label}
                </span>
                <span className="sr-only">
                  {item.passed === false ? 'Not met' : 'Met'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}
