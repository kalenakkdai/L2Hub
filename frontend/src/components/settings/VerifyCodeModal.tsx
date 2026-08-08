import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Check, Loader2, TriangleAlert, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { CodeInput } from './CodeInput'
import {
  CODE_LENGTH,
  ERROR_MESSAGES,
  canResend,
  classifyError,
  initialState,
  secondsUntilResend,
  smsConfigured,
  verificationReducer,
  type VerificationChannel,
} from '../../lib/verification'

type VerifyCodeModalProps = {
  open: boolean
  channel: VerificationChannel
  /** The address or number being verified, shown so the camper can check it. */
  destination: string
  onClose: () => void
  /** Called once verification succeeds, after the check animation. */
  onVerified: () => void
  send: (destination: string) => Promise<void>
  verify: (destination: string, code: string) => Promise<void>
}

/**
 * Verification modal.
 *
 * All state transitions go through the reducer in lib/verification — this
 * component decides only what to draw and when to call Supabase. Codes are
 * generated, stored, and expired by Supabase; nothing here does any of that.
 */
export function VerifyCodeModal({
  open,
  channel,
  destination,
  onClose,
  onVerified,
  send,
  verify,
}: VerifyCodeModalProps) {
  const [state, dispatch] = useReducer(verificationReducer, initialState)
  const [code, setCode] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const closeRef = useRef<HTMLButtonElement>(null)
  const startedFor = useRef<string | null>(null)

  const noun = channel === 'email' ? 'email address' : 'phone number'

  const dispatchSend = useCallback(async () => {
    dispatch({ type: 'SEND' })
    try {
      await send(destination)
      dispatch({ type: 'SENT', now: Date.now() })
    } catch (error) {
      dispatch({ type: 'SEND_FAILED', reason: classifyError(error), now: Date.now() })
    }
  }, [destination, send])

  // Send once per opening, not on every render that happens to have open=true.
  useEffect(() => {
    if (!open) {
      startedFor.current = null
      dispatch({ type: 'RESET' })
      setCode('')
      return
    }

    if (startedFor.current === destination) return
    startedFor.current = destination
    void dispatchSend()
  }, [open, destination, dispatchSend])

  // Drives the resend countdown. One second is precise enough for a timer a
  // person is watching, and it stops as soon as the modal closes.
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const submit = useCallback(
    async (value: string) => {
      dispatch({ type: 'SUBMIT' })
      try {
        await verify(destination, value)
        dispatch({ type: 'VERIFIED' })
        // Let the check land before handing back.
        window.setTimeout(onVerified, 900)
      } catch (error) {
        dispatch({ type: 'REJECTED', reason: classifyError(error) })
        setCode('')
      }
    },
    [destination, verify, onVerified],
  )

  if (!open) return null

  const resendSeconds = secondsUntilResend(state, now)
  const resendReady = canResend(state, now)
  const showDevBanner = channel === 'phone' && !smsConfigured()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-navy-950/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-title"
        className="relative w-full max-w-md rounded-card border border-border-subtle bg-surface p-6 shadow-overlay"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="verify-title" className="text-title font-semibold text-ink">
              Verify your {noun}
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              We sent a {CODE_LENGTH}-digit code to{' '}
              <span className="font-medium text-ink">{destination}</span>.
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-subtle transition hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {showDevBanner && (
          <p className="mt-4 rounded-control border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[13px] text-status-warning">
            SMS is not configured for this Campsite, so phone verification cannot be
            completed yet.
          </p>
        )}

        <div className="mt-5">
          {state.status === 'sending' && (
            <p
              role="status"
              className="flex items-center gap-2.5 py-6 text-sm text-ink-subtle"
            >
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Sending your code…
            </p>
          )}

          {state.status === 'verified' && (
            <div role="status" className="flex flex-col items-center gap-3 py-6">
              {/* The one piece of motion allowed in Settings. */}
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100">
                <Check
                  aria-hidden="true"
                  className="h-6 w-6 animate-[riseIn_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] text-accent-ink"
                />
              </span>
              <p className="font-medium text-ink">Verified</p>
            </div>
          )}

          {(state.status === 'awaiting_code' ||
            state.status === 'verifying' ||
            state.status === 'error') && (
            <>
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={(value) => void submit(value)}
                disabled={state.status === 'verifying'}
                invalid={state.status === 'error'}
              />

              {state.status === 'error' && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 text-sm text-status-danger"
                >
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {ERROR_MESSAGES[state.reason]}
                </p>
              )}

              {state.status === 'verifying' && (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 text-sm text-ink-subtle"
                >
                  <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  Checking your code…
                </p>
              )}

              <div className="mt-5 flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!resendReady || state.status === 'verifying'}
                  onClick={() => void dispatchSend()}
                >
                  {resendReady ? 'Resend code' : `Resend in ${resendSeconds}s`}
                </Button>

                <Button
                  size="sm"
                  disabled={code.length !== CODE_LENGTH || state.status === 'verifying'}
                  onClick={() => void submit(code)}
                >
                  Verify
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
