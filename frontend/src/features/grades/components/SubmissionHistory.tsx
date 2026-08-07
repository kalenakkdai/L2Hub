import type { SubmissionHistoryItem } from '../types'
import { formatDateTime } from '../utils/format'

export interface SubmissionHistoryProps {
  items: SubmissionHistoryItem[]
  isLoading?: boolean
  errorMessage?: string | null
}

export function SubmissionHistory({
  items,
  isLoading,
  errorMessage,
}: SubmissionHistoryProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-slate-500" role="status">
        Loading submission history…
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500" role="status">
        No submission history is available.
      </p>
    )
  }

  const ordered = [...items].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  )

  return (
    <section aria-labelledby="submission-history-heading">
      <h2
        id="submission-history-heading"
        className="text-[13px] font-semibold text-slate-900"
      >
        Submission History
      </h2>
      <ol className="mt-3 space-y-0 border-l border-slate-200">
        {ordered.map((item) => (
          <li key={item.id} className="relative pl-4 py-2">
            <span
              className="absolute -left-1 top-3 h-2 w-2 rounded-full bg-slate-400"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-900">{item.label}</p>
            <p className="text-xs text-slate-500">
              {formatDateTime(item.occurredAt)}
              {item.description ? ` · ${item.description}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
