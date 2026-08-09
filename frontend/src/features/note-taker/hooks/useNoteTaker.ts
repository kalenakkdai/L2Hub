import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMeetingSession,
  getMeetingNote,
  getMeetingSession,
  getMeetingTranscript,
  linkMeetingToEvent,
  listMeetingSessions,
  renameMeetingSession,
  unlinkMeetingFromEvent,
  uploadMeetingAudio,
} from '../api/client'

const sessionsKey = ['note-taker', 'sessions'] as const

export function useMeetingSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: async () => (await listMeetingSessions()).sessions,
  })
}

/** Meeting docs filed under one event, newest first. */
export function useEventMeetingSessions(eventId: string | undefined) {
  return useQuery({
    queryKey: ['note-taker', 'sessions', 'event', eventId],
    queryFn: async () => (await listMeetingSessions(eventId)).sessions,
    enabled: Boolean(eventId),
  })
}

export function useMeetingSession(sessionId: string) {
  return useQuery({
    queryKey: ['note-taker', 'session', sessionId],
    queryFn: () => getMeetingSession(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'processing' || status === 'uploading' ? 2000 : false
    },
  })
}

export function useMeetingTranscript(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['note-taker', 'transcript', sessionId],
    queryFn: () => getMeetingTranscript(sessionId),
    enabled,
  })
}

export function useMeetingNote(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['note-taker', 'note', sessionId],
    queryFn: () => getMeetingNote(sessionId),
    enabled,
  })
}

export function useNoteTakerCommands() {
  const queryClient = useQueryClient()

  const createSession = useMutation({
    mutationFn: (input: { title?: string; eventId?: string | null }) =>
      createMeetingSession(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
    },
  })

  const renameSession = useMutation({
    mutationFn: (input: { sessionId: string; title: string }) =>
      renameMeetingSession(input.sessionId, input.title),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
      void queryClient.invalidateQueries({
        queryKey: ['note-taker', 'session', session.id],
      })
    },
  })

  const uploadAudio = useMutation({
    mutationFn: (input: {
      sessionId: string
      blob: Blob
      durationMs: number | null
      transcript?: {
        fullText: string
        segments: Array<{ startMs: number; endMs: number; text: string }>
        language: string | null
      } | null
    }) =>
      uploadMeetingAudio(
        input.sessionId,
        input.blob,
        input.durationMs,
        input.transcript,
      ),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
      void queryClient.invalidateQueries({
        queryKey: ['note-taker', 'session', session.id],
      })
    },
  })

  const linkToEvent = useMutation({
    mutationFn: (input: { sessionId: string; eventId: string }) =>
      linkMeetingToEvent(input.sessionId, input.eventId),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
      void queryClient.invalidateQueries({
        queryKey: ['note-taker', 'session', session.id],
      })
      for (const eventId of session.eventIds ?? []) {
        void queryClient.invalidateQueries({
          queryKey: ['note-taker', 'sessions', 'event', eventId],
        })
      }
    },
  })

  const unlinkFromEvent = useMutation({
    mutationFn: (input: { sessionId: string; eventId: string }) =>
      unlinkMeetingFromEvent(input.sessionId, input.eventId),
    onSuccess: (_session, variables) => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
      void queryClient.invalidateQueries({
        queryKey: ['note-taker', 'session', variables.sessionId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['note-taker', 'sessions', 'event', variables.eventId],
      })
    },
  })

  return { createSession, renameSession, uploadAudio, linkToEvent, unlinkFromEvent }
}
