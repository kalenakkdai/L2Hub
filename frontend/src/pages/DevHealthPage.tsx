import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchHealth } from '../api/health'

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">L2 Hub</h1>
        <p className="text-slate-600">
          Student-government operations for Leadership 2. This page checks that
          the frontend can reach the backend health endpoint.
        </p>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium">Backend health</h2>

          {healthQuery.isPending && (
            <p className="mt-2 text-slate-500">Checking backend…</p>
          )}

          {healthQuery.isError && (
            <p className="mt-2 text-red-600">
              Could not reach backend:{' '}
              {healthQuery.error instanceof Error
                ? healthQuery.error.message
                : 'Unknown error'}
            </p>
          )}

          {healthQuery.isSuccess && (
            <p className="mt-2 text-green-700">
              Connected — status: {healthQuery.data.status}
            </p>
          )}
        </section>

        <Link to="/" className="text-sm text-slate-500 underline hover:text-slate-700">
          Back to L2 Hub
        </Link>
      </div>
    </main>
  )
}
