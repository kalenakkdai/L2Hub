import { apiFetch } from '../../api/client'
import type {
  MessengerAgendaSession,
  MessengerConnection,
} from '../types'

export function getMessengerConnection(): Promise<MessengerConnection> {
  return apiFetch('/messenger-agenda/connection')
}

export function connectMessenger(
  grantedThreadIds: string[] = [],
): Promise<MessengerConnection> {
  return apiFetch('/messenger-agenda/connection/connect', {
    method: 'POST',
    body: JSON.stringify({ grantedThreadIds }),
  })
}

export function disconnectMessenger(): Promise<MessengerConnection> {
  return apiFetch('/messenger-agenda/connection/disconnect', {
    method: 'POST',
  })
}

export function listMessengerSessions(): Promise<{
  sessions: MessengerAgendaSession[]
}> {
  return apiFetch('/messenger-agenda/sessions')
}

export function createMessengerSession(input: {
  title?: string
  source?: 'paste' | 'messenger'
  threadId?: string
  threadLabel?: string
  startKeyword?: string
  endKeyword?: string
}): Promise<MessengerAgendaSession> {
  return apiFetch('/messenger-agenda/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getMessengerSession(
  sessionId: string,
): Promise<MessengerAgendaSession> {
  return apiFetch(`/messenger-agenda/sessions/${sessionId}`)
}

export function startMessengerCapture(
  sessionId: string,
): Promise<MessengerAgendaSession> {
  return apiFetch(`/messenger-agenda/sessions/${sessionId}/start`, {
    method: 'POST',
  })
}

export function ingestMessengerText(
  sessionId: string,
  rawText: string,
  append = false,
): Promise<MessengerAgendaSession> {
  return apiFetch(`/messenger-agenda/sessions/${sessionId}/ingest`, {
    method: 'POST',
    body: JSON.stringify({ rawText, append }),
  })
}

export function finalizeMessengerSession(
  sessionId: string,
): Promise<MessengerAgendaSession> {
  return apiFetch(`/messenger-agenda/sessions/${sessionId}/finalize`, {
    method: 'POST',
  })
}

export function generateMessengerAssignments(
  sessionId: string,
): Promise<MessengerAgendaSession> {
  return apiFetch(
    `/messenger-agenda/sessions/${sessionId}/assignments/generate`,
    { method: 'POST' },
  )
}

export function attachMessengerPlan(
  sessionId: string,
  planId: string,
): Promise<MessengerAgendaSession> {
  return apiFetch(`/messenger-agenda/sessions/${sessionId}/attach-plan`, {
    method: 'POST',
    body: JSON.stringify({ planId }),
  })
}
