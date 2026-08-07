import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchHealth } from '../api/health'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'

/**
 * Developer diagnostics at /dev/health. Deliberately unauthenticated: it
 * checks that the frontend can reach the backend, which needs to work even
 * when sign-in does not.
 */
export function DevHealthPage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16 sm:px-6">
        <div>
          <h1 className="text-display font-semibold text-ink">L2 Hub</h1>
          <p className="mt-2 text-ink-muted">
            Student-government operations for Leadership 2. This page checks that
            the frontend can reach the backend health endpoint.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-title font-semibold text-ink">Backend health</h2>

            {healthQuery.isSuccess && <StatusBadge tone="accent">Connected</StatusBadge>}
            {healthQuery.isError && <StatusBadge tone="danger">Unreachable</StatusBadge>}
          </div>

          {healthQuery.isPending && (
            <p className="mt-3 text-sm text-ink-muted">Checking backend…</p>
          )}

          {healthQuery.isError && (
            <p className="mt-3 text-sm text-status-danger">
              Could not reach backend:{' '}
              {healthQuery.error instanceof Error
                ? healthQuery.error.message
                : 'Unknown error'}
            </p>
          )}

          {healthQuery.isSuccess && (
            <p className="mt-3 text-sm text-ink-muted">
              Connected — status: {healthQuery.data.status}
            </p>
          )}
        </Card>

        <Link
          to="/"
          className="text-sm text-ink-subtle underline underline-offset-2 hover:text-ink"
        >
          Back to L2 Hub
        </Link>
      </div>
    </main>
  )
}
