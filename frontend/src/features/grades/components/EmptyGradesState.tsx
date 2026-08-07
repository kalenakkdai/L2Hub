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
      className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center"
    >
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
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
      className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
