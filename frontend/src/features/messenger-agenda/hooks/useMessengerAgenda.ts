import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/client'

export const messengerAgendaKeys = {
  all: ['messenger-agenda'] as const,
  connection: () => [...messengerAgendaKeys.all, 'connection'] as const,
  sessions: () => [...messengerAgendaKeys.all, 'sessions'] as const,
  session: (id: string) => [...messengerAgendaKeys.all, 'session', id] as const,
}

export function useMessengerConnection() {
  return useQuery({
    queryKey: messengerAgendaKeys.connection(),
    queryFn: api.getMessengerConnection,
  })
}

export function useMessengerSessions() {
  return useQuery({
    queryKey: messengerAgendaKeys.sessions(),
    queryFn: async () => (await api.listMessengerSessions()).sessions,
  })
}

export function useMessengerSession(sessionId: string) {
  return useQuery({
    queryKey: messengerAgendaKeys.session(sessionId),
    queryFn: () => api.getMessengerSession(sessionId),
    enabled: Boolean(sessionId),
  })
}

export function useMessengerAgendaCommands() {
  const queryClient = useQueryClient()

  const invalidate = async (sessionId?: string) => {
    await queryClient.invalidateQueries({ queryKey: messengerAgendaKeys.all })
    if (sessionId) {
      await queryClient.invalidateQueries({
        queryKey: messengerAgendaKeys.session(sessionId),
      })
    }
  }

  return {
    connect: useMutation({
      mutationFn: (ids: string[]) => api.connectMessenger(ids),
      onSuccess: () => invalidate(),
    }),
    disconnect: useMutation({
      mutationFn: () => api.disconnectMessenger(),
      onSuccess: () => invalidate(),
    }),
    createSession: useMutation({
      mutationFn: api.createMessengerSession,
      onSuccess: () => invalidate(),
    }),
    startCapture: useMutation({
      mutationFn: (sessionId: string) => api.startMessengerCapture(sessionId),
      onSuccess: (session) => invalidate(session.id),
    }),
    ingest: useMutation({
      mutationFn: (input: {
        sessionId: string
        rawText: string
        append?: boolean
      }) => api.ingestMessengerText(input.sessionId, input.rawText, input.append),
      onSuccess: (session) => invalidate(session.id),
    }),
    finalize: useMutation({
      mutationFn: (sessionId: string) => api.finalizeMessengerSession(sessionId),
      onSuccess: (session) => invalidate(session.id),
    }),
    generateAssignments: useMutation({
      mutationFn: (sessionId: string) =>
        api.generateMessengerAssignments(sessionId),
      onSuccess: (session) => invalidate(session.id),
    }),
    attachPlan: useMutation({
      mutationFn: (input: { sessionId: string; planId: string }) =>
        api.attachMessengerPlan(input.sessionId, input.planId),
      onSuccess: (session) => invalidate(session.id),
    }),
  }
}
