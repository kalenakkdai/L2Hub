import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from '../components/FullPageMessage'
import { Button } from '../components/ui/Button'
import { cn } from '../components/ui/cn'
import { AuthPitch, FIELD } from './authLayout'
import { DevAccountsPanel } from './DevAccountsPanel'

type LoginFields = {
  email: string
  password: string
}

type LocationState = { from?: string } | null

export function LoginPage() {
  const { status, sessionExpired, signIn, clearSessionExpired } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    defaultValues: { email: '', password: '' },
  })

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
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AuthPitch />

      <div className="flex items-center justify-center bg-surface-sunken px-4 py-12 sm:px-14">
        <div className="animate-rise-in w-full max-w-[392px] [animation-delay:120ms]">
          <h1 className="text-[28px] font-bold tracking-[-0.022em] text-ink">Welcome back</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-subtle">
            Sign in with your school account to continue.
          </p>
          {sessionExpired && (
          <p
            role="status"
            className="mt-6 rounded-control border border-status-warning-bg bg-status-warning-bg p-3 text-sm text-status-warning"
          >
            Your session expired. Please sign in again.
          </p>
        )}

          <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
            <label htmlFor="email" className="mb-1.5 text-[13px] font-medium text-ink">
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
              <p className="mt-1.5 text-sm text-status-danger">{errors.email.message}</p>
            )}

            <div className="mt-4 mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-ink">
                Password
              </label>
              <Link
                to="/login"
                className="text-[12.5px] text-accent-600 underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={cn(FIELD, 'pr-11')}
                aria-invalid={errors.password ? 'true' : undefined}
                {...register('password', { required: 'Password is required.' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-pressed={showPassword}
                className="absolute top-[5px] right-[5px] flex h-[34px] w-[34px] items-center justify-center rounded-control text-ink-subtle transition duration-200 hover:bg-surface-muted"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-sm text-status-danger">{errors.password.message}</p>
            )}

            {formError && (
              <p role="alert" className="mt-3 text-sm text-status-danger">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting} size="lg" className="mt-5 w-full">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-ink-subtle">
            Starting a new club?{' '}
            <Link
              to="/signup"
              className="font-medium text-accent-600 underline-offset-2 hover:underline"
            >
              Set up your Campsite
            </Link>
          </p>

          <DevAccountsPanel />
        </div>
      </div>
    </main>
  )
}
