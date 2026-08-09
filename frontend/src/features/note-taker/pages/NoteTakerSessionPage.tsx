import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchEvents } from '../../event-summary/api'
import { fetchMeetingAudioObjectUrl } from '../api/client'
import {
  useMeetingNote,
  useMeetingSession,
  useMeetingTranscript,
} from '../hooks/useNoteTaker'
import { eventOptionLabel, eventTimelinePath } from '../lib/eventOptions'
import { ErrorState } from '../../../components/ui/ErrorState'

type Tab = 'note' | 'transcript' | 'audio'

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function NoteTakerSessionPage() {
  const { sessionId = '' } = useParams()
  const [tab, setTab] = useState<Tab>('note')
  const session = useMeetingSession(sessionId)
  const ready = session.data?.status === 'ready'
  const note = useMeetingNote(sessionId, ready && tab === 'note')
  const transcript = useMeetingTranscript(sessionId, ready && tab === 'transcript')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  // Only to name the event this doc sits on; the id alone would read as a UUID.
  const filedEventId = session.data?.eventId ?? null
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    enabled: Boolean(filedEventId),
  })
  const filedEventLabel = useMemo(() => {
    if (!filedEventId) return null
    const match = eventsQuery.data?.events.find(
      (item) => item.id === filedEventId,
    )
    return match ? eventOptionLabel(match) : null
  }, [eventsQuery.data, filedEventId])

  useEffect(() => {
    if (tab !== 'audio' || !sessionId || !session.data?.hasAudio) return
    let cancelled = false
    let objectUrl: string | null = null
    setAudioError(null)
    void fetchMeetingAudioObjectUrl(sessionId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setAudioUrl(url)
      })
      .catch(() => {
        if (!cancelled) setAudioError('Could not load the original audio.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [tab, sessionId, session.data?.hasAudio])

  if (session.isPending) {
    return <p className="text-sm text-ink-muted">Loading meeting…</p>
  }
  if (session.isError || !session.data) {
    return (
      <ErrorState
        title="Could not load meeting"
        description="It may have been deleted, or you may not have access."
        onRetry={() => void session.refetch()}
      />
    )
  }

  const meeting = session.data
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'note', label: 'Meeting note' },
    { id: 'transcript', label: 'Raw transcript' },
    { id: 'audio', label: 'Original audio' },
  ]

  return (
    <div>
      <header className="mb-5 border-b border-border-subtle pb-4">
        <p className="text-xs font-semibold text-ink-subtle">
          <Link to="/note-taker" className="hover:text-ink">
            Note Taker
          </Link>
        </p>
        <h1 className="mt-1 text-display font-semibold text-ink">{meeting.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Status: {meeting.status}
          {meeting.durationMs != null
            ? ` · ${Math.round(meeting.durationMs / 1000)}s recorded`
            : ''}
        </p>
        {filedEventId ? (
          <p className="mt-1 text-xs text-ink-muted">
            Filed under{' '}
            <Link
              to={eventTimelinePath(filedEventId)}
              className="font-medium text-status-info hover:underline"
            >
              {filedEventLabel ?? 'this event'}
            </Link>
            {' · opens the event timeline'}
          </p>
        ) : null}
        {meeting.status === 'processing' || meeting.status === 'uploading' ? (
          <p className="mt-2 text-sm text-status-warning">
            Drafting the meeting note from the Chrome transcript…
          </p>
        ) : null}
        {meeting.status === 'failed' ? (
          <p className="mt-2 text-sm text-status-danger">
            {meeting.errorMessage ?? 'Transcription failed.'}
          </p>
        ) : null}
      </header>

      <nav
        aria-label="Meeting sections"
        className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === item.id
                ? 'border-accent-600 text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'note' ? (
        <section className="space-y-4">
          {!ready ? (
            <p className="text-sm text-ink-muted">
              The meeting note appears here when transcription finishes.
            </p>
          ) : note.isPending ? (
            <p className="text-sm text-ink-muted">Loading note…</p>
          ) : note.isError || !note.data ? (
            <ErrorState
              title="Could not load note"
              description="Try again in a moment."
              onRetry={() => void note.refetch()}
            />
          ) : (
            <>
              <div className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
                <h2 className="text-lg font-semibold text-ink">{note.data.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {note.data.summary || 'No summary yet.'}
                </p>
              </div>
              {note.data.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
                >
                  <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                  {section.bullets.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-subtle">None detected.</p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </section>
      ) : null}

      {tab === 'transcript' ? (
        <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
          {!ready ? (
            <p className="text-sm text-ink-muted">
              The full raw transcript appears here after processing finishes.
            </p>
          ) : transcript.isPending ? (
            <p className="text-sm text-ink-muted">Loading transcript…</p>
          ) : transcript.isError || !transcript.data ? (
            <ErrorState
              title="Could not load transcript"
              description="Try again in a moment."
              onRetry={() => void transcript.refetch()}
            />
          ) : (
            <>
              <h2 className="text-sm font-semibold text-ink">Raw transcript</h2>
              <p className="mt-1 text-xs text-ink-subtle">
                {transcript.data.provider ?? 'chrome-web-speech'}
                {transcript.data.language ? ` · ${transcript.data.language}` : ''}
              </p>
              {transcript.data.segments.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {transcript.data.segments.map((segment, index) => (
                    <li key={`${segment.startMs}-${index}`} className="text-sm">
                      <span className="font-mono text-[11px] text-ink-subtle">
                        {formatTimestamp(segment.startMs)}
                      </span>
                      <p className="text-ink-muted">{segment.text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <pre className="mt-4 whitespace-pre-wrap text-sm text-ink-muted">
                  {transcript.data.fullText || 'No speech detected.'}
                </pre>
              )}
              {transcript.data.segments.length > 0 && transcript.data.fullText ? (
                <details className="mt-6">
                  <summary className="cursor-pointer text-xs font-semibold text-ink-subtle">
                    Full text
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                    {transcript.data.fullText}
                  </pre>
                </details>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {tab === 'audio' ? (
        <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Original audio</h2>
          <p className="mt-1 text-xs text-ink-subtle">
            A saved copy of the recording from this session.
          </p>
          {!meeting.hasAudio ? (
            <p className="mt-4 text-sm text-ink-muted">No audio was stored.</p>
          ) : audioError ? (
            <p className="mt-4 text-sm text-status-danger">{audioError}</p>
          ) : !audioUrl ? (
            <p className="mt-4 text-sm text-ink-muted">Loading audio…</p>
          ) : (
            <audio className="mt-4 w-full" controls src={audioUrl}>
              Your browser does not support audio playback.
            </audio>
          )}
        </section>
      ) : null}
    </div>
  )
}
