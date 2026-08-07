import { supabase } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** The session is gone or no longer accepted — the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/** The request reached the API and was refused for some other reason. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Call the FastAPI backend as the signed-in user.
 *
 * The access token is read from the Supabase session on every call rather
 * than cached here. supabase-js refreshes it when it is close to expiring,
 * so reading late means always sending a current token — and there is only
 * ever one copy of it, owned by the Supabase client.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    throw new SessionExpiredError()
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  // The backend rejects the token it was given: expired, revoked, or from a
  // session the server no longer trusts. Either way, re-authenticate.
  if (response.status === 401) {
    throw new SessionExpiredError()
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response))
  }

  return (await response.json()) as T
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`
}
