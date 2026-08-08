import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from '../components/FullPageMessage'
import { Button, ButtonLink } from '../components/ui/Button'
import { cn } from '../components/ui/cn'
import { AuthPitch, FIELD } from './authLayout'

type SignUpFields = {
  firstName: string
  lastName: string
  email: string
  password: string
}

const MIN_PASSWORD_LENGTH = 8

export function SignUpPage() {
  const { status, signUp } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFields>({
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  })

  if (status === 'loading') {
    return <FullPageMessage>Loading…</FullPageMessage>
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = handleSubmit(async (fields) => {
    setFormError(null)

    try {
      const { needsConfirmation } = await signUp(fields)
      // When confirmation is off, the session starts immediately and the
      // authenticated redirect above takes over on the next render.
      if (needsConfirmation) setConfirmationSentTo(fields.email)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not create your account.',
      )
    }
  })

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AuthPitch />

      <div className="flex items-center justify-center bg-surface-sunken px-4 py-12 sm:px-14">
        <div className="animate-rise-in w-full max-w-[392px] [animation-delay:120ms]">
          {confirmationSentTo ? (
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-card bg-accent-100">
                <MailCheck aria-hidden="true" className="h-5 w-5 text-accent-600" />
              </span>
              <h1 className="mt-4 text-[28px] font-bold tracking-[-0.022em] text-ink">
                Check your email
              </h1>
              <p role="status" className="mt-2 text-[14.5px] text-ink-subtle">
                We sent a confirmation link to{' '}
                <span className="font-medium text-ink">{confirmationSentTo}</span>. Open it
                to finish setting up your Campsite.
              </p>
              <ButtonLink to="/login" variant="secondary" className="mt-6">
                Back to sign in
              </ButtonLink>
            </div>
          ) : (
            <>
              <h1 className="text-[28px] font-bold tracking-[-0.022em] text-ink">
                Join the Quad
              </h1>
              <p className="mt-1.5 text-[14.5px] text-ink-subtle">
                Your name is how the rest of your Campsite will see you.
              </p>

              <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label
                      htmlFor="firstName"
                      className="mb-1.5 text-[13px] font-medium text-ink"
                    >
                      First name
                    </label>
                    <input
                      id="firstName"
                      autoComplete="given-name"
                      className={FIELD}
                      aria-invalid={errors.firstName ? 'true' : undefined}
                      {...register('firstName', { required: 'First name is required.' })}
                    />
                    {errors.firstName && (
                      <p className="mt-1.5 text-sm text-status-danger">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label
                      htmlFor="lastName"
                      className="mb-1.5 text-[13px] font-medium text-ink"
                    >
                      Last name
                    </label>
                    <input
                      id="lastName"
                      autoComplete="family-name"
                      className={FIELD}
                      aria-invalid={errors.lastName ? 'true' : undefined}
                      {...register('lastName', { required: 'Last name is required.' })}
                    />
                    {errors.lastName && (
                      <p className="mt-1.5 text-sm text-status-danger">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <label htmlFor="email" className="mt-4 mb-1.5 text-[13px] font-medium text-ink">
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

                <label
                  htmlFor="password"
                  className="mt-4 mb-1.5 text-[13px] font-medium text-ink"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={cn(FIELD, 'pr-11')}
                    aria-invalid={errors.password ? 'true' : undefined}
                    aria-describedby="password-hint"
                    {...register('password', {
                      required: 'Password is required.',
                      minLength: {
                        value: MIN_PASSWORD_LENGTH,
                        message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
                      },
                    })}
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
                {errors.password ? (
                  <p className="mt-1.5 text-sm text-status-danger">
                    {errors.password.message}
                  </p>
                ) : (
                  <p id="password-hint" className="mt-1.5 text-[12.5px] text-ink-subtle">
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )}

                {formError && (
                  <p role="alert" className="mt-3 text-sm text-status-danger">
                    {formError}
                  </p>
                )}

                <Button type="submit" disabled={isSubmitting} size="lg" className="mt-5 w-full">
                  {isSubmitting ? 'Creating your account…' : 'Create account'}
                  {!isSubmitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                </Button>
              </form>

              <p className="mt-4 text-center text-[13px] text-ink-subtle">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-accent-600 underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
