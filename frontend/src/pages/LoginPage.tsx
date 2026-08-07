import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  Eye,
  EyeOff,
  MessagesSquare,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from '../components/FullPageMessage'
import { Button } from '../components/ui/Button'
import { cn } from '../components/ui/cn'
import { DevAccountsPanel } from './DevAccountsPanel'

const FIELD =
  'h-11 w-full rounded-card border border-border-subtle bg-surface px-3 text-[14.5px] text-ink transition duration-200 ease-out-quick outline-none placeholder:text-ink-subtle focus:border-accent-600 focus:ring-[3px] focus:ring-accent-600/13 aria-invalid:border-status-danger'

const PITCH: { icon: LucideIcon; text: string }[] = [
  { icon: MessagesSquare, text: 'Five-minute event debriefs, submitted together' },
  { icon: BookOpenCheck, text: 'Grades that follow from what you actually did' },
  { icon: UsersRound, text: 'Committees, rosters, and assignments that stay straight' },
]

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
      {/* The pitch. Hidden on small screens, where it would push the form
          below the fold for no benefit. */}
      <aside className="on-navy hidden flex-col justify-between bg-navy-900 p-14 lg:flex">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent-600 text-[13px] font-bold text-white"
          >
            Q
          </span>
          <span className="font-semibold text-navy-ink">The Quad</span>
        </div>

        <div className="animate-rise-in max-w-[470px] [animation-delay:80ms]">
          <h2 className="text-[46px] leading-[1.08] font-bold tracking-[-0.028em] text-navy-ink">
            Every club gets a Campsite.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-navy-ink-muted text-pretty">
            A Campsite is one club&rsquo;s hub on the Quad — its campers, its committees,
            its events, and its work in one place.
          </p>

          <ul className="mt-9 flex flex-col gap-0.5">
            {PITCH.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="-mx-3 flex items-center gap-3.5 rounded-control px-3 py-2.5 transition duration-[260ms] ease-out-quick hover:bg-white/8"
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-400" />
                <span className="text-[14.5px] text-navy-ink-muted">{text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex items-center gap-4">
            <span className="font-mono text-[12.5px] text-navy-ink-subtle">
              9 Campsites on the Quad
            </span>
            <span aria-hidden="true" className="dotted-trail-dark h-px flex-1" />
          </div>
        </div>

        <p className="text-[12.5px] text-navy-ink-subtle">
          Mission San Jose High School · Leadership 2
        </p>
      </aside>

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

          <DevAccountsPanel />
        </div>
      </div>
    </main>
  )
}
