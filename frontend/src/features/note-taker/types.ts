export type MeetingSessionStatus =
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed'

export type MeetingSessionSummary = {
  id: string
  title: string
  /** Event this meeting was originally recorded under, when set. */
  eventId: string | null
  /** Every event fire this log currently sits under (many-to-many). */
  eventIds?: string[]
  status: MeetingSessionStatus
  durationMs: number | null
  audioContentType: string | null
  audioSizeBytes: number | null
  hasAudio: boolean
  hasTranscript: boolean
  hasNote: boolean
  errorMessage: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string | null
  createdBy: string
  noteTitle: string | null
}

export type TranscriptSegment = {
  startMs: number
  endMs: number
  text: string
}

export type MeetingTranscript = {
  fullText: string
  segments: TranscriptSegment[]
  language: string | null
  provider: string | null
  createdAt?: string | null
}

export type MeetingNoteSection = {
  title: string
  bullets: string[]
}

export type MeetingNote = {
  title: string
  summary: string
  sections: MeetingNoteSection[]
  createdAt?: string | null
  updatedAt?: string | null
}
