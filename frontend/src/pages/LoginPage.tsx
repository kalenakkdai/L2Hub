import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from '../components/FullPageMessage'

type LoginFields = {
  email: string
  password: string
}

type LocationState = { from?: string } | null

export function LoginPage() {
  const { status, sessionExpired, signIn, clearSessionExpired } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ defaultValues: { email: '', password: '' } })

  if (status === 'loading') {
    return <FullPageMessage>Loading…</FullPageMessage>
  }

  // Already signed in — no reason to show a login form. Return to wherever
  // RequireAuth bounced them from, or the dashboard.
  if (status === 'authenticated') {
    const from = (location.state as LocationState)?.from
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    clearSessionExpired()

    try {
      await signIn(email, password)
    } catch (error) {
      // Supabase returns the same message for a bad password and an unknown
      // address, which is what we want: it does not reveal who has an account.
      setFormError(
        error instanceof Error ? error.message : 'Could not sign in. Please try again.',
      )
    }
  })

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-20">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">L2 Hub</h1>
          <p className="mt-1 text-slate-600">Sign in to continue.</p>
        </div>

        {sessionExpired && (
          <p
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            Your session expired. Please sign in again.
          </p>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="rounded-md border border-slate-300 bg-white px-3 py-2"
              aria-invalid={errors.email ? 'true' : undefined}
              {...register('email', { required: 'Email is required.' })}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="rounded-md border border-slate-300 bg-white px-3 py-2"
              aria-invalid={errors.password ? 'true' : undefined}
              {...register('password', { required: 'Password is required.' })}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
