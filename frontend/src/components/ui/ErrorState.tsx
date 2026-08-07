import { AlertTriangle, Lock } from 'lucide-react'
import { Card } from './Card'
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
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span
        className={
          isUnauthorized
            ? 'flex h-10 w-10 items-center justify-center rounded-full bg-status-neutral-bg'
            : 'flex h-10 w-10 items-center justify-center rounded-full bg-status-danger-bg'
        }
      >
        <Icon
          aria-hidden="true"
          className={
            isUnauthorized ? 'h-5 w-5 text-status-neutral' : 'h-5 w-5 text-status-danger'
          }
        />
      </span>

      {/* role=alert on the wrapper so the reason is announced along with the
       * heading — a title alone tells a screen reader user nothing useful. */}
      <div role="alert">
        <p className="mt-3 font-medium text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      </div>

      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  )
}
