export function EmptyGradesState({
  title = 'No gradebook assignments yet.',
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <div
      role="status"
      className="rounded-card border border-dashed border-border-strong bg-surface px-4 py-10 text-center"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      ) : null}
    </div>
  )
}

export function GradesErrorState({
  message = "We couldn't load your grades.",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-card border border-status-danger-bg bg-status-danger-bg px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-status-danger">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-control bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
