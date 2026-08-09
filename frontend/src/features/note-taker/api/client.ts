import { ApiError, SessionExpiredError } from '../../../api/client'
import { supabase } from '../../../lib/supabase'
import type {
  MeetingNote,
  MeetingSessionSummary,
  MeetingTranscript,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new SessionExpiredError()
  }
  return data.session.access_token
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (
      body.detail &&
      typeof body.detail === 'object' &&
      'message' in body.detail &&
      typeof (body.detail as { message: unknown }).message === 'string'
    ) {
      return (body.detail as { message: string }).message
    }
  } catch {
    // fall through
  }
  return `Request failed with status ${response.status}`
}

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function listMeetingSessions(
  eventId?: string,
): Promise<{ sessions: MeetingSessionSummary[] }> {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
  return jsonFetch(`/note-taker/sessions${query}`)
}

/** Omit the title to accept the server's auto-generated document name. */
export function createMeetingSession(input: {
  title?: string
  eventId?: string | null
}): Promise<MeetingSessionSummary> {
  const title = input.title?.trim()
  return jsonFetch('/note-taker/sessions', {
    method: 'POST',
    body: JSON.stringify({
      title: title ? title : null,
      eventId: input.eventId ?? null,
    }),
  })
}

export function renameMeetingSession(
  sessionId: string,
  title: string,
): Promise<MeetingSessionSummary> {
  return jsonFetch(`/note-taker/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

/** Place a reusable meeting log under an event fire (idempotent). */
export function linkMeetingToEvent(
  sessionId: string,
  eventId: string,
): Promise<MeetingSessionSummary> {
  return jsonFetch(`/note-taker/sessions/${sessionId}/events/${eventId}`, {
    method: 'POST',
  })
}

/** Remove a log from a fire without deleting the meeting. */
export function unlinkMeetingFromEvent(
  sessionId: string,
  eventId: string,
): Promise<MeetingSessionSummary> {
  return jsonFetch(`/note-taker/sessions/${sessionId}/events/${eventId}`, {
    method: 'DELETE',
  })
}

/** The name a new meeting for this event would get, for a preview label. */
export function getSuggestedMeetingTitle(
  eventId?: string | null,
): Promise<{ title: string }> {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
  return jsonFetch(`/note-taker/suggested-title${query}`)
}

export function getMeetingSession(sessionId: string): Promise<MeetingSessionSummary> {
  return jsonFetch(`/note-taker/sessions/${sessionId}`)
}

export function getMeetingTranscript(sessionId: string): Promise<MeetingTranscript> {
  return jsonFetch(`/note-taker/sessions/${sessionId}/transcript`)
}

export function getMeetingNote(sessionId: string): Promise<MeetingNote> {
  return jsonFetch(`/note-taker/sessions/${sessionId}/note`)
}

/** Upload recorded audio plus the Chrome Web Speech transcript. */
export async function uploadMeetingAudio(
  sessionId: string,
  blob: Blob,
  durationMs: number | null,
  transcript?: {
    fullText: string
    segments: Array<{ startMs: number; endMs: number; text: string }>
    language: string | null
  } | null,
): Promise<MeetingSessionSummary> {
  const token = await accessToken()
  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  if (durationMs != null) {
    form.append('durationMs', String(Math.round(durationMs)))
  }
  if (transcript?.fullText.trim()) {
    form.append('transcriptFullText', transcript.fullText.trim())
    form.append('transcriptSegmentsJson', JSON.stringify(transcript.segments))
    if (transcript.language) {
      form.append('transcriptLanguage', transcript.language)
    }
    form.append('transcriptProvider', 'chrome-web-speech')
  }

  const response = await fetch(`${API_BASE_URL}/note-taker/sessions/${sessionId}/audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response))
  return (await response.json()) as MeetingSessionSummary
}

/** Fetch the original audio as a blob URL for an <audio> element. */
export async function fetchMeetingAudioObjectUrl(sessionId: string): Promise<string> {
  const token = await accessToken()
  const response = await fetch(`${API_BASE_URL}/note-taker/sessions/${sessionId}/audio`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) throw new SessionExpiredError()
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response))
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
