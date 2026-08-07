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
      <p className="text-sm text-ink-muted" role="status">
        Loading submission history…
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-status-danger" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-muted" role="status">
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
        className="text-[13px] font-semibold text-ink"
      >
        Submission History
      </h2>
      <ol className="mt-3 space-y-0 border-l border-border-subtle">
        {ordered.map((item) => (
          <li key={item.id} className="relative py-2 pl-4">
            <span
              className="absolute top-3 -left-1 h-2 w-2 rounded-full bg-ink-subtle"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-ink">{item.label}</p>
            <p className="text-xs text-ink-subtle">
              {formatDateTime(item.occurredAt)}
              {item.description ? ` · ${item.description}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
