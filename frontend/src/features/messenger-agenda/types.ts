export type MessengerAgendaStatus = 'idle' | 'capturing' | 'finalized'

export type MessengerThread = {
  id: string
  label: string
  granted?: boolean
}

export type MessengerConnection = {
  status: 'disconnected' | 'connected'
  grantedThreads: MessengerThread[]
  metaConfigured: boolean
  connectedAt: string | null
}

export type AgendaSection = {
  title: string
  bullets: string[]
}

export type MessengerAgendaDoc = {
  title?: string
  summary?: string
  goals?: string[]
  sections?: AgendaSection[]
}

export type AssignmentDraft = {
  roleLabel: string
  committeeSlug: string
  committeeName: string
  sourceLine: string
  targetType: 'committee' | 'member'
}

export type MessengerAgendaSession = {
  id: string
  title: string
  status: MessengerAgendaStatus
  source: 'paste' | 'messenger'
  threadId: string | null
  threadLabel: string | null
  startKeyword: string
  endKeyword: string
  rawText: string
  capturedText: string
  agenda: MessengerAgendaDoc
  assignments: AssignmentDraft[]
  planId: string | null
  capturingStartedAt: string | null
  finalizedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}
