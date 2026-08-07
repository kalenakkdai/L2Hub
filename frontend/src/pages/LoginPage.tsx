import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from '../components/FullPageMessage'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

const FIELD =
  'rounded-control border border-border-strong bg-surface px-3 py-2 text-ink placeholder:text-ink-subtle aria-invalid:border-status-danger'

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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-card bg-navy-900 text-base font-bold text-white"
          >
            L2
          </span>
        </div>

        <h1 className="mt-5 text-center text-display font-semibold text-ink">L2 Hub</h1>
        <p className="mt-1 text-center text-ink-muted">Sign in to continue.</p>

        {sessionExpired && (
          <p
            role="status"
            className="mt-6 rounded-control border border-status-warning-bg bg-status-warning-bg p-3 text-sm text-status-warning"
          >
            Your session expired. Please sign in again.
          </p>
        )}

        <Card className="mt-6 p-6">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={FIELD}
                aria-invalid={errors.email ? 'true' : undefined}
                {...register('email', { required: 'Email is required.' })}
              />
              {errors.email && (
                <p className="text-sm text-status-danger">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={FIELD}
                aria-invalid={errors.password ? 'true' : undefined}
                {...register('password', { required: 'Password is required.' })}
              />
              {errors.password && (
                <p className="text-sm text-status-danger">{errors.password.message}</p>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-sm text-status-danger">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
