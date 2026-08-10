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

/** A bullet plus the chat member it came from, when the line was attributed. */
export type AgendaBullet = {
  text: string
  speaker?: string | null
}

export type AgendaSection = {
  title: string
  bullets: AgendaBullet[]
}

export type MessengerAgendaDoc = {
  title?: string
  summary?: string
  goals?: AgendaBullet[]
  sections?: AgendaSection[]
}

/** Color legend entry, one per person who spoke inside the capture window. */
export type Contributor = {
  name: string
  color: string
  highlight: string
  initials: string
  lineCount: number
}

export type AssignmentDraft = {
  roleLabel: string
  committeeSlug: string
  committeeName: string
  sourceLine: string
  attributedTo?: string | null
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
  contributors: Contributor[]
  /** Captured window split into speaker-attributed lines. */
  transcript: AgendaBullet[]
  planId: string | null
  capturingStartedAt: string | null
  finalizedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}
