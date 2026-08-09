import { Link, useOutletContext } from 'react-router-dom'
import { Mic } from 'lucide-react'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LOG_MIME, MeetingLogVisual } from '../components/MeetingLog'
import { useMeetingSessions } from '../hooks/useNoteTaker'
import { statusLabel, statusTone } from '../lib/statusLabel'

type OutletContext = { canRecord: boolean }

export function NoteTakerListPage() {
  const { canRecord } = useOutletContext<OutletContext>()
  const sessions = useMeetingSessions()

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-display font-semibold text-ink">Note Taker</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Record a meeting, keep the original audio, and get a transcript plus
            meeting notes. Drag a log onto an event fire on Event planning — the
            same log can sit under many fires.
          </p>
        </div>
        {canRecord ? (
          <Link
            to="/note-taker/new"
            className="inline-flex items-center gap-2 rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            <Mic size={16} aria-hidden="true" />
            New recording
          </Link>
        ) : null}
      </header>

      {sessions.isPending ? (
        <p className="text-sm text-ink-muted">Loading meetings…</p>
      ) : null}
      {sessions.isError ? (
        <ErrorState
          title="Could not load meetings"
          description="Check that the backend is running."
          onRetry={() => void sessions.refetch()}
        />
      ) : null}

      {sessions.data && sessions.data.length === 0 ? (
        <p className="rounded-card border border-border-subtle bg-surface px-4 py-8 text-center text-sm text-ink-muted shadow-xs">
          No meetings yet. Start a recording to capture audio, a raw transcript,
          and a meeting note.
        </p>
      ) : null}

      {sessions.data && sessions.data.length > 0 ? (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs">
          {sessions.data.map((session) => (
            <li key={session.id}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-sunken">
                <button
                  type="button"
                  draggable={canRecord}
                  aria-label={`Drag log ${session.title}`}
                  title={
                    canRecord
                      ? 'Drag onto an event fire on Event planning'
                      : undefined
                  }
                  onDragStart={(dragEvent) => {
                    if (!canRecord) return
                    dragEvent.dataTransfer.setData(LOG_MIME, session.id)
                    dragEvent.dataTransfer.setData('text/plain', session.id)
                    dragEvent.dataTransfer.effectAllowed = 'copy'
                  }}
                  className={[
                    'shrink-0 rounded-control border border-border-subtle bg-surface-sunken px-2 py-1',
                    canRecord ? 'cursor-grab active:cursor-grabbing' : 'opacity-70',
                  ].join(' ')}
                >
                  <MeetingLogVisual title={session.title} size="yard" />
                </button>
                <Link
                  to={`/note-taker/${session.id}`}
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{session.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {session.createdAt
                        ? new Date(session.createdAt).toLocaleString()
                        : '—'}
                      {session.noteTitle && session.noteTitle !== session.title
                        ? ` · ${session.noteTitle}`
                        : ''}
                      {session.eventIds && session.eventIds.length > 0
                        ? ` · on ${session.eventIds.length} fire${session.eventIds.length === 1 ? '' : 's'}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-control px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                      session.status,
                    )}`}
                  >
                    {statusLabel(session.status)}
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
