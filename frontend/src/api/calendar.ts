import { apiFetch } from './client'

/**
 * iCal subscription feed.
 *
 * The token is fetched through the API rather than selected from
 * campsite_settings over PostgREST: the migration deliberately revokes
 * `select (feed_token)` from `authenticated`, because the token is a bearer
 * credential that keeps working after the session that read it has expired.
 */

export type Crew = {
  id: string
  slug: string
  name: string
}

export type Subscription = {
  token: string
  campsiteName: string
  crews: Crew[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export function getSubscription(): Promise<Subscription> {
  return apiFetch<Subscription>('/calendar/subscription')
}

export function rotateSubscription(): Promise<{ token: string }> {
  return apiFetch<{ token: string }>('/calendar/subscription/rotate', {
    method: 'POST',
  })
}

/**
 * Builds the URL a camper pastes into their calendar app.
 *
 * Absolute, because it is consumed by Google's servers rather than by this
 * browser — a relative path would resolve against google.com. `crewId` of
 * null means the whole-Campsite feed.
 */
export function subscribeUrl(token: string, crewId: string | null = null): string {
  const path = crewId ? `/committees/${crewId}/calendar.ics` : '/calendar.ics'
  return `${API_BASE_URL}${path}?token=${encodeURIComponent(token)}`
}

/**
 * The same URL over webcal://, which is what makes a click open the calendar
 * app instead of downloading a file. Not a real protocol — Apple Calendar and
 * Outlook register a handler for it, and both treat it as https underneath.
 */
export function webcalUrl(token: string, crewId: string | null = null): string {
  return subscribeUrl(token, crewId).replace(/^https?:\/\//, 'webcal://')
}
