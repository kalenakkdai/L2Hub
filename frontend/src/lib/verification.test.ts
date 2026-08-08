import { describe, expect, it } from 'vitest'
import {
  ERROR_MESSAGES,
  RESEND_COOLDOWN_SECONDS,
  canResend,
  classifyError,
  initialState,
  secondsUntilResend,
  verificationReducer,
  type VerificationState,
} from './verification'

const T0 = 1_000_000

/** Drives the reducer through a list of events, starting from idle. */
function run(...events: Parameters<typeof verificationReducer>[1][]): VerificationState {
  return events.reduce(verificationReducer, initialState)
}

describe('verification state machine', () => {
  it('starts idle', () => {
    expect(initialState).toEqual({ status: 'idle' })
  })

  it('walks the happy path: idle → sending → awaiting → verifying → verified', () => {
    const sending = verificationReducer(initialState, { type: 'SEND' })
    expect(sending.status).toBe('sending')

    const awaiting = verificationReducer(sending, { type: 'SENT', now: T0 })
    expect(awaiting).toEqual({
      status: 'awaiting_code',
      resendAvailableAt: T0 + RESEND_COOLDOWN_SECONDS * 1000,
    })

    const verifying = verificationReducer(awaiting, { type: 'SUBMIT' })
    expect(verifying.status).toBe('verifying')

    expect(verificationReducer(verifying, { type: 'VERIFIED' }).status).toBe('verified')
  })

  it('ignores a second send while one is already in flight', () => {
    const sending = run({ type: 'SEND' })
    // Double-clicking resend must not fire two requests.
    expect(verificationReducer(sending, { type: 'SEND' })).toBe(sending)
  })

  it('ignores a send once verified', () => {
    const verified = run(
      { type: 'SEND' },
      { type: 'SENT', now: T0 },
      { type: 'SUBMIT' },
      { type: 'VERIFIED' },
    )
    expect(verificationReducer(verified, { type: 'SEND' })).toBe(verified)
  })

  it('ignores VERIFIED unless a check is in flight', () => {
    const awaiting = run({ type: 'SEND' }, { type: 'SENT', now: T0 })
    // Guards against a late response from a cancelled attempt.
    expect(verificationReducer(awaiting, { type: 'VERIFIED' })).toBe(awaiting)
  })

  describe('errors', () => {
    it('reports an invalid code and clears the in-flight state', () => {
      const state = run(
        { type: 'SEND' },
        { type: 'SENT', now: T0 },
        { type: 'SUBMIT' },
        { type: 'REJECTED', reason: 'invalid_code' },
      )

      expect(state).toEqual({
        status: 'error',
        reason: 'invalid_code',
        resendAvailableAt: null,
      })
    })

    it.each(['invalid_code', 'expired_code', 'rate_limited'] as const)(
      'carries the %s reason through',
      (reason) => {
        const state = run(
          { type: 'SEND' },
          { type: 'SENT', now: T0 },
          { type: 'SUBMIT' },
          { type: 'REJECTED', reason },
        )
        expect(state).toMatchObject({ status: 'error', reason })
      },
    )

    it('allows an immediate retry after a rejected code', () => {
      const state = run(
        { type: 'SEND' },
        { type: 'SENT', now: T0 },
        { type: 'SUBMIT' },
        { type: 'REJECTED', reason: 'invalid_code' },
      )

      // The code was wrong, not the request — no reason to make them wait.
      expect(canResend(state, T0)).toBe(true)
      expect(verificationReducer(state, { type: 'SUBMIT' }).status).toBe('verifying')
    })

    it('holds a rate-limited sender behind the cooldown', () => {
      const state = run(
        { type: 'SEND' },
        { type: 'SEND_FAILED', reason: 'rate_limited', now: T0 },
      )

      expect(canResend(state, T0)).toBe(false)
      expect(canResend(state, T0 + RESEND_COOLDOWN_SECONDS * 1000)).toBe(true)
    })

    it('lets a failed send be retried immediately', () => {
      const state = run({ type: 'SEND' }, { type: 'SEND_FAILED', reason: 'send_failed', now: T0 })

      expect(canResend(state, T0)).toBe(true)
    })

    it('surfaces an unconfigured SMS provider as its own reason', () => {
      const state = run(
        { type: 'SEND' },
        { type: 'SEND_FAILED', reason: 'sms_not_configured', now: T0 },
      )
      expect(state).toMatchObject({ status: 'error', reason: 'sms_not_configured' })
    })
  })

  describe('resend cooldown', () => {
    it(`opens after ${RESEND_COOLDOWN_SECONDS} seconds`, () => {
      const awaiting = run({ type: 'SEND' }, { type: 'SENT', now: T0 })

      expect(canResend(awaiting, T0)).toBe(false)
      expect(canResend(awaiting, T0 + 44_000)).toBe(false)
      expect(canResend(awaiting, T0 + 45_000)).toBe(true)
    })

    it('counts down whole seconds and floors at zero', () => {
      const awaiting = run({ type: 'SEND' }, { type: 'SENT', now: T0 })

      expect(secondsUntilResend(awaiting, T0)).toBe(RESEND_COOLDOWN_SECONDS)
      expect(secondsUntilResend(awaiting, T0 + 44_100)).toBe(1)
      expect(secondsUntilResend(awaiting, T0 + 60_000)).toBe(0)
    })

    it('restarts the cooldown on a resend', () => {
      const first = run({ type: 'SEND' }, { type: 'SENT', now: T0 })
      const later = T0 + 50_000
      const second = verificationReducer(
        verificationReducer(first, { type: 'SEND' }),
        { type: 'SENT', now: later },
      )

      expect(canResend(second, later)).toBe(false)
      expect(secondsUntilResend(second, later)).toBe(RESEND_COOLDOWN_SECONDS)
    })

    it('reports no countdown when verified', () => {
      const verified = run(
        { type: 'SEND' },
        { type: 'SENT', now: T0 },
        { type: 'SUBMIT' },
        { type: 'VERIFIED' },
      )
      expect(secondsUntilResend(verified, T0)).toBe(0)
    })
  })

  it('RESET returns to idle from anywhere', () => {
    const verified = run(
      { type: 'SEND' },
      { type: 'SENT', now: T0 },
      { type: 'SUBMIT' },
      { type: 'VERIFIED' },
    )
    expect(verificationReducer(verified, { type: 'RESET' })).toEqual(initialState)
  })
})

describe('classifyError', () => {
  it.each([
    ['Email rate limit exceeded', 'rate_limited'],
    ['Too many requests', 'rate_limited'],
    ['Token has expired or is invalid', 'invalid_code'],
    ['Invalid token', 'invalid_code'],
    ['Unsupported phone provider', 'sms_not_configured'],
  ] as const)('maps %s', (message, expected) => {
    expect(classifyError(new Error(message))).toBe(expected)
  })

  /**
   * Captured verbatim from a local Supabase by scripts/verify_verification.py.
   * The prose here is not invented — these are the exact bodies GoTrue
   * returns, which is the point: the previous matching was written against
   * what the errors were assumed to say.
   */
  describe('against what GoTrue actually returns', () => {
    function authError(message: string, code: string) {
      return Object.assign(new Error(message), { code })
    }

    it('recognises the resend cooldown', () => {
      const error = authError(
        'For security purposes, you can only request this after 4 seconds.',
        'over_sms_send_rate_limit',
      )

      // Says neither "rate limit" nor "too many", so the old matching fell
      // through to invalid_code — telling a camper their code was wrong
      // before they had typed one, and skipping the cooldown, since only
      // rate_limited holds it.
      expect(classifyError(error)).toBe('rate_limited')
    })

    it('recognises the cooldown from the message alone', () => {
      // supabase-js does not always surface error_code.
      expect(
        classifyError(new Error('For security purposes, you can only request this after 4 seconds.')),
      ).toBe('rate_limited')
    })

    it('does not claim a mistyped code has expired', () => {
      // A wrong code and an expired one are the same response, so nothing can
      // tell them apart and the message must be true of both.
      const error = authError('Token has expired or is invalid', 'otp_expired')

      expect(classifyError(error)).toBe('invalid_code')
      expect(ERROR_MESSAGES.invalid_code).toMatch(/not right, or it has expired/)
    })

    it('recognises a missing SMS provider', () => {
      const error = authError('Unsupported phone provider', 'phone_provider_disabled')
      expect(classifyError(error)).toBe('sms_not_configured')
    })
  })

  it('treats an unrecognised failure as an invalid code', () => {
    // Failing closed keeps the camper on the entry screen rather than
    // implying the code worked.
    expect(classifyError(new Error('something unexpected'))).toBe('invalid_code')
    expect(classifyError(null)).toBe('invalid_code')
  })
})
