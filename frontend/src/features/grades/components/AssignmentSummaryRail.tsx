import type { ReactNode } from 'react'
import { Check, Info, X } from 'lucide-react'
import type { GradeAssignmentDetail } from '../types'
import { GradeStatusIndicator } from './GradeStatusIndicator'
import { formatDateTimeLong, formatScore } from '../utils/format'

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[11px] font-semibold text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">{value}</dd>
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
      className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs lg:h-full lg:rounded-none lg:border-0 lg:border-l lg:bg-surface-sunken lg:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {entry.event?.name ?? 'Assignment'}
        </h2>
        <GradeStatusIndicator status={entry.status} />
      </div>

      <p className="mt-3 flex gap-2 rounded-control bg-status-info-bg px-3 py-2 text-[11px] leading-4 text-status-info">
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
        <div className="mt-4 border-t border-border-subtle pt-3">
          <p className="text-[11px] font-semibold text-ink-subtle">
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
                    className="mt-0.5 shrink-0 text-status-danger"
                    aria-hidden="true"
                  />
                ) : (
                  <Check
                    size={11}
                    className="mt-0.5 shrink-0 text-accent-700"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    item.passed === false
                      ? 'text-status-danger'
                      : 'text-accent-700'
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
