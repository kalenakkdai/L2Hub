import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCurrentUser, roleLabel } from '../api/auth'
import { ApiError, SessionExpiredError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useSignOutOnExpiry } from '../auth/useSignOutOnExpiry'

/**
 * Minimal authenticated landing page: who you are, and a way out.
 * The role-aware dashboard is a later phase.
 */
export function DashboardPage() {
  const { signOut } = useAuth()

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      // A rejected token or a refused request will be refused identically on
      // the next attempt. Only retry things that might genuinely be transient.
      if (error instanceof SessionExpiredError) return false
      if (error instanceof ApiError && error.status < 500) return false
      return failureCount < 2
    },
  })

  // A dead session signs the user out; RequireAuth then sends them to /login.
  useSignOutOnExpiry(meQuery.error)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">L2 Hub</h1>
            <p className="mt-1 text-slate-600">Your account</p>
          </div>

          <button
            type="button"
            onClick={() => void signOut('manual')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Log out
          </button>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          {meQuery.isPending && <p className="text-slate-500">Loading your profile…</p>}

          {meQuery.isError && !(meQuery.error instanceof SessionExpiredError) && (
            <p role="alert" className="text-red-600">
              Could not load your profile:{' '}
              {meQuery.error instanceof Error ? meQuery.error.message : 'Unknown error'}
            </p>
          )}

          {meQuery.isSuccess && (
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-sm text-slate-500">Name</dt>
                <dd className="text-lg font-medium">
                  {meQuery.data.full_name ?? meQuery.data.email}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Role</dt>
                <dd className="text-lg font-medium">{roleLabel(meQuery.data.role)}</dd>
              </div>
            </dl>
          )}
        </section>

        <Link
          to="/dev/health"
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Backend health
        </Link>
      </div>
    </main>
  )
}
