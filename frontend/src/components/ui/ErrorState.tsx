import { AlertTriangle, Lock } from 'lucide-react'
import { Button } from './Button'

type ErrorStateProps = {
  title: string
  description: string
  onRetry?: () => void
  /** `unauthorized` reframes the state as a permissions issue, not a fault. */
  variant?: 'error' | 'unauthorized'
}

export function ErrorState({
  title,
  description,
  onRetry,
  variant = 'error',
}: ErrorStateProps) {
  const isUnauthorized = variant === 'unauthorized'
  const Icon = isUnauthorized ? Lock : AlertTriangle

  return (
    <div className="rounded-card border border-border-subtle bg-surface px-6 py-8 text-center shadow-card">
      <span
        className={
          isUnauthorized
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted'
            : 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-status-danger-bg'
        }
      >
        <Icon
          aria-hidden="true"
          className={
            isUnauthorized ? 'h-5 w-5 text-ink-subtle' : 'h-5 w-5 text-status-danger'
          }
        />
      </span>

      {/* role=alert on the wrapper so the reason is announced along with the
       * heading — a title alone tells a screen reader user nothing useful. */}
      <div role="alert">
        <p className="mt-3 font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-subtle">{description}</p>
      </div>

      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
