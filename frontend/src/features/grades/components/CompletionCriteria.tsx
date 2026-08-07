import type { GradeFeedback } from '../types'
import { Check, X } from 'lucide-react'

const kindLabels: Record<NonNullable<GradeFeedback['kind']>, string> = {
  completion_criteria: 'Completion Criteria',
  requirements: 'Requirements',
  submission_checks: 'Submission Checks',
  officer_feedback: 'Officer Feedback',
  adviser_feedback: 'Adviser Feedback',
}

export function CompletionCriteria({ feedback }: { feedback: GradeFeedback }) {
  const heading = feedback.kind
    ? kindLabels[feedback.kind]
    : 'Completion Criteria'

  return (
    <section aria-labelledby="completion-criteria-heading">
      <h2
        id="completion-criteria-heading"
        className="text-[13px] font-semibold text-slate-900"
      >
        {heading}
      </h2>
      {feedback.summary ? (
        <p className="mt-1 text-xs text-slate-600">{feedback.summary}</p>
      ) : null}
      {feedback.items && feedback.items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {feedback.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 text-sm text-slate-800"
            >
              {item.passed === true ? (
                <Check
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : item.passed === false ? (
                <X
                  size={16}
                  className="mt-0.5 shrink-0 text-red-600"
                  aria-hidden="true"
                />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {item.label}
                {typeof item.pointsEarned === 'number' &&
                typeof item.pointsPossible === 'number'
                  ? ` (${item.pointsEarned} / ${item.pointsPossible})`
                  : ''}
                {item.note ? (
                  <span className="block text-slate-500">{item.note}</span>
                ) : null}
              </span>
              <span className="sr-only">
                {item.passed === true
                  ? 'Passed'
                  : item.passed === false
                    ? 'Not passed'
                    : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
