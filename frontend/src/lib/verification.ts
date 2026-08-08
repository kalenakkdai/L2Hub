import { supabase } from './supabase'

/**
 * Contact verification, as a state machine.
 *
 * Supabase owns code generation, delivery, storage, and expiry. Nothing here
 * creates or checks a code — it only tracks which screen the modal should be
 * on and turns Supabase's errors into states a person can act on.
 */

export type VerificationChannel = 'email' | 'phone'

export type VerificationState =
  | { status: 'idle' }
  | { status: 'sending' }
  /** Code dispatched; waiting for the camper to enter it. */
  | { status: 'awaiting_code'; resendAvailableAt: number }
  | { status: 'verifying' }
  | { status: 'verified' }
  | { status: 'error'; reason: VerificationError; resendAvailableAt: number | null }

export type VerificationError =
  | 'invalid_code'
  | 'expired_code'
  | 'rate_limited'
  | 'send_failed'
  | 'sms_not_configured'

export type VerificationEvent =
  | { type: 'SEND' }
  | { type: 'SENT'; now: number }
  | { type: 'SEND_FAILED'; reason: VerificationError; now: number }
  | { type: 'SUBMIT' }
  | { type: 'VERIFIED' }
  | { type: 'REJECTED'; reason: VerificationError }
  | { type: 'RESET' }

/** Seconds a camper must wait before a resend is offered. */
export const RESEND_COOLDOWN_SECONDS = 45

export const CODE_LENGTH = 6

export const initialState: VerificationState = { status: 'idle' }

function cooldownFrom(now: number): number {
  return now + RESEND_COOLDOWN_SECONDS * 1000
}

/**
 * Pure reducer. Every transition is explicit; anything unexpected leaves the
 * state untouched rather than dropping into a state the UI cannot render.
 */
export function verificationReducer(
  state: VerificationState,
  event: VerificationEvent,
): VerificationState {
  switch (event.type) {
    case 'SEND':
      // Resending is allowed from an error, but not while one is in flight.
      if (state.status === 'sending' || state.status === 'verifying') return state
      if (state.status === 'verified') return state
      return { status: 'sending' }

    case 'SENT':
      if (state.status !== 'sending') return state
      return { status: 'awaiting_code', resendAvailableAt: cooldownFrom(event.now) }

    case 'SEND_FAILED':
      if (state.status !== 'sending') return state
      return {
        status: 'error',
        reason: event.reason,
        // A rate limit is the one failure where retrying immediately is
        // pointless, so it keeps the camper behind the cooldown.
        resendAvailableAt:
          event.reason === 'rate_limited' ? cooldownFrom(event.now) : null,
      }

    case 'SUBMIT':
      if (state.status !== 'awaiting_code' && state.status !== 'error') return state
      return { status: 'verifying' }

    case 'VERIFIED':
      if (state.status !== 'verifying') return state
      return { status: 'verified' }

    case 'REJECTED': {
      if (state.status !== 'verifying') return state
      return { status: 'error', reason: event.reason, resendAvailableAt: null }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

/** True when the camper may ask for another code. */
export function canResend(state: VerificationState, now: number): boolean {
  if (state.status === 'awaiting_code') return now >= state.resendAvailableAt
  if (state.status === 'error') {
    return state.resendAvailableAt === null || now >= state.resendAvailableAt
  }
  return state.status === 'idle'
}

/** Whole seconds left on the resend cooldown, floored at zero. */
export function secondsUntilResend(state: VerificationState, now: number): number {
  const target =
    state.status === 'awaiting_code'
      ? state.resendAvailableAt
      : state.status === 'error'
        ? state.resendAvailableAt
        : null

  if (target === null) return 0
  return Math.max(0, Math.ceil((target - now) / 1000))
}

export const ERROR_MESSAGES: Record<VerificationError, string> = {
  // Supabase answers a wrong code and an expired one identically, so this
  // covers both rather than guessing which happened and telling half the
  // campers who see it something untrue.
  invalid_code: 'That code is not right, or it has expired. Check it, or send a new one.',
  expired_code: 'That code has expired. Send a new one.',
  rate_limited: 'Too many attempts. Wait a moment before trying again.',
  send_failed: 'We could not send the code. Try again in a moment.',
  sms_not_configured:
    'Text messaging is not set up for this Campsite yet, so phone verification is unavailable.',
}

/**
 * Maps a Supabase auth error onto one of our reasons.
 *
 * `error_code` is checked first. It is the stable part of a GoTrue error; the
 * prose is not, and reading the prose alone got two cases wrong against a real
 * server:
 *
 *   * a rate-limited resend says "For security purposes, you can only request
 *     this after N seconds", which contains neither "rate limit" nor "too
 *     many". It fell through to invalid_code, so a camper who pressed Resend
 *     too quickly was told their code was wrong before they had typed one —
 *     and, because only rate_limited holds the cooldown, was free to keep
 *     pressing it.
 *   * a wrong code and an expired code are the same response, `otp_expired`
 *     with "Token has expired or is invalid". Matching "expired" first meant a
 *     mistyped digit was reported as an expired code. Nothing can tell them
 *     apart, so they share one reason and one honest message.
 *
 * Anything unrecognised is treated as an invalid code, which is the safe
 * reading: it keeps the camper on the entry screen rather than claiming
 * success.
 */
export function classifyError(error: unknown): VerificationError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code ?? '')
      : ''

  if (code.includes('rate_limit')) return 'rate_limited'
  if (code === 'otp_expired' || code === 'otp_disabled') return 'invalid_code'
  if (code === 'phone_provider_disabled' || code === 'sms_send_failed') {
    return 'sms_not_configured'
  }

  const raw = error instanceof Error ? error.message : String(error ?? '')
  const message = raw.toLowerCase()

  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    // GoTrue's own wording for the resend cooldown.
    message.includes('security purposes')
  ) {
    return 'rate_limited'
  }
  if (
    message.includes('sms provider') ||
    message.includes('phone provider') ||
    message.includes('unsupported phone provider') ||
    message.includes('signups not allowed for otp')
  ) {
    return 'sms_not_configured'
  }
  if (message.includes('expired') || message.includes('invalid') || message.includes('token')) {
    return 'invalid_code'
  }

  return 'invalid_code'
}

/** Whether the Campsite has an SMS provider configured. */
export function smsConfigured(): boolean {
  return import.meta.env.VITE_SMS_ENABLED === 'true'
}

// ---------------------------------------------------------------------------
// Supabase calls
//
// Thin wrappers. They exist so the modal never imports supabase directly and
// so tests can mock one module instead of the whole auth client.
// ---------------------------------------------------------------------------

/** Starts email verification by requesting the address change Supabase confirms. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email })
  if (error) throw error
}

/**
 * Starts phone verification by attaching the number to the signed-in camper.
 *
 * NOT signInWithOtp. That is a sign-in: it mints a separate phone-only
 * account, the signup trigger gives that account a profile of its own, and
 * verifyOtp then hands the browser a session belonging to it — so verifying
 * your number signed you out of yourself, into an empty account whose email
 * was blank, and left your own phone_verified false forever. The phantom
 * profiles reached the admin roster with status 'active', which is the
 * predicate transfer_admin uses to decide who may receive administration.
 *
 * updateUser sends the same OTP but keeps the caller's identity, mirroring
 * what sendEmailCode already does for the address.
 */
export async function sendPhoneCode(phone: string): Promise<void> {
  if (!smsConfigured()) {
    throw new Error('Unsupported phone provider')
  }

  const { error } = await supabase.auth.updateUser({ phone })
  if (error) throw error
}

/** Confirms the pending number change — not a phone sign-in. */
export async function verifyPhoneCode(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' })
  if (error) throw error
}
