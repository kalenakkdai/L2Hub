import { useMemo, useState, type DragEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Mic } from 'lucide-react'
import { fetchEvents, type EventListItem } from '../../event-summary/api'
import { groupEvents } from '../../event-summary/lib/groupEvents'
import { campfireHeading, selectCampfireEvents } from '../lib/campfireEvents'
import {
  useEventMeetingSessions,
  useMeetingSessions,
  useNoteTakerCommands,
} from '../hooks/useNoteTaker'
import { statusLabel } from '../lib/statusLabel'
import type { MeetingSessionSummary } from '../types'
import { MeetingConstellation } from './MeetingConstellation'
import { LOG_MIME, MeetingLogVisual, NamedLogsUnderFire } from './MeetingLog'
import { TinyCampfire } from './TinyCampfire'

function whenLabel(event: EventListItem): string | null {
  if (!event.startsAt) return null
  const starts = new Date(event.startsAt)
  if (Number.isNaN(starts.getTime())) return null
  return starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function readLogDragId(event: DragEvent): string | null {
  return (
    event.dataTransfer.getData(LOG_MIME) ||
    event.dataTransfer.getData('text/plain') ||
    null
  )
}

type RowProps = {
  event: EventListItem
  seed: number
  banked: boolean
  canRecord: boolean
  open: boolean
  onToggle: () => void
  yardLogs: MeetingSessionSummary[]
  selectedLogId: string | null
  onDropLog: (sessionId: string, eventId: string) => void
  linking: boolean
}

function EventCampfireRow({
  event,
  seed,
  banked,
  canRecord,
  open,
  onToggle,
  yardLogs,
  selectedLogId,
  onDropLog,
  linking,
}: RowProps) {
  const sessions = useEventMeetingSessions(event.id)
  const { renameSession } = useNoteTakerCommands()
  const count = sessions.data?.length ?? 0
  const panelId = `event-meeting-timeline-${event.id}`
  const when = whenLabel(event)
  const [dragOver, setDragOver] = useState(false)

  const namedLogs = (sessions.data ?? []).map((session) => ({
    id: session.id,
    title: session.title,
  }))

  return (
    <li id={`campfire-${event.id}`}>
      <div
        className={[
          'flex flex-wrap items-start gap-3 px-4 py-3 transition-colors',
          dragOver ? 'bg-amber-400/15 ring-1 ring-inset ring-amber-300/40' : '',
        ].join(' ')}
        onDragOver={(dragEvent) => {
          if (!canRecord) return
          dragEvent.preventDefault()
          dragEvent.dataTransfer.dropEffect = 'copy'
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(dragEvent) => {
          if (!canRecord) return
          dragEvent.preventDefault()
          setDragOver(false)
          const sessionId = readLogDragId(dragEvent)
          if (sessionId) onDropLog(sessionId, event.id)
        }}
      >
        <div className="flex w-[7.5rem] shrink-0 flex-col items-center pt-1">
          <TinyCampfire
            size={52}
            seed={seed}
            banked={banked}
            logCount={count}
            label={`${event.name} ${event.year} fire with ${count} log${count === 1 ? '' : 's'}`}
          />
          <NamedLogsUnderFire logs={namedLogs} />
          {canRecord && selectedLogId ? (
            <button
              type="button"
              disabled={linking}
              onClick={() => onDropLog(selectedLogId, event.id)}
              className="mt-2 rounded-control bg-white/15 px-2 py-1 text-[10px] font-semibold text-navy-ink hover:bg-white/25 disabled:opacity-50"
            >
              Add selected log
            </button>
          ) : null}
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${event.name} ${event.year} timeline`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left hover:bg-white/[0.04]"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-ink">
              {event.name} {event.year}
            </span>
            <span className="block text-xs text-navy-ink-muted">
              {when ? `${when} · ` : ''}
              {count === 0
                ? 'Drop logs here — fire grows with each one'
                : `${count} log${count === 1 ? '' : 's'} on this fire`}
            </span>
            {canRecord && yardLogs.length > 0 ? (
              <label className="mt-2 block text-[10px] text-navy-ink-muted">
                Or choose a log
                <select
                  className="mt-0.5 block w-full max-w-xs rounded-control border border-white/20 bg-black/30 px-2 py-1 text-xs text-navy-ink"
                  defaultValue=""
                  disabled={linking}
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                  onChange={(changeEvent) => {
                    const sessionId = changeEvent.target.value
                    changeEvent.target.value = ''
                    if (sessionId) onDropLog(sessionId, event.id)
                  }}
                >
                  <option value="">Add a meeting log…</option>
                  {yardLogs.map((log) => (
                    <option key={log.id} value={log.id}>
                      {log.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </span>
          <ChevronRight
            aria-hidden="true"
            size={16}
            className={`ml-auto shrink-0 text-navy-ink-muted transition-transform duration-200 ${
              open ? 'rotate-90' : ''
            }`}
          />
        </button>

        {canRecord ? (
          <Link
            to={`/note-taker/new?eventId=${encodeURIComponent(event.id)}&eventName=${encodeURIComponent(`${event.name} ${event.year}`)}`}
            className="inline-flex items-center gap-1.5 rounded-control bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-navy-ink hover:bg-white/25"
          >
            <Mic size={14} aria-hidden="true" />
            Record meeting
          </Link>
        ) : null}
      </div>

      {open ? (
        <div id={panelId} className="border-t border-white/10 bg-black/20">
          {sessions.isPending ? (
            <p className="px-4 py-4 text-xs text-navy-ink-muted">
              Loading meeting docs…
            </p>
          ) : (
            <MeetingConstellation
              sessions={sessions.data ?? []}
              canRename={canRecord}
              renaming={renameSession.isPending}
              onRename={(sessionId, title) =>
                renameSession.mutate({ sessionId, title })
              }
            />
          )}
        </div>
      ) : null}
    </li>
  )
}

type LogYardProps = {
  logs: MeetingSessionSummary[]
  selectedLogId: string | null
  onSelect: (sessionId: string | null) => void
  canDrag: boolean
}

function LogYard({ logs, selectedLogId, onSelect, canDrag }: LogYardProps) {
  if (logs.length === 0) {
    return (
      <p className="border-b border-white/12 px-4 py-3 text-xs text-navy-ink-muted">
        No meeting logs yet. Record one in Note Taker, then drag it onto a fire —
        the same log can feed many fires.
      </p>
    )
  }

  return (
    <div className="border-b border-white/12 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-ink-muted">
        Log yard
      </p>
      <p className="mt-0.5 text-[11px] text-navy-ink-muted">
        Drag a log onto a fire pit (or select one and use Add). Logs are reusable.
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {logs.map((log) => {
          const selected = selectedLogId === log.id
          return (
            <li key={log.id}>
              <button
                type="button"
                draggable={canDrag}
                onDragStart={(dragEvent) => {
                  if (!canDrag) return
                  dragEvent.dataTransfer.setData(LOG_MIME, log.id)
                  dragEvent.dataTransfer.setData('text/plain', log.id)
                  dragEvent.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onSelect(selected ? null : log.id)}
                aria-pressed={selected}
                className={[
                  'rounded-control border px-2 py-1.5 text-left transition-colors',
                  selected
                    ? 'border-amber-300/70 bg-amber-400/20'
                    : 'border-white/15 bg-black/25 hover:bg-white/10',
                  canDrag ? 'cursor-grab active:cursor-grabbing' : '',
                ].join(' ')}
              >
                <MeetingLogVisual title={log.title} size="yard" />
                <span className="mt-0.5 block text-center text-[10px] text-navy-ink-muted">
                  {statusLabel(log.status)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type EventCampfireBoardProps = {
  permissions: string[] | undefined
}

/**
 * Bridge between Note Taker and event planning.
 *
 * Meeting docs are reusable wood logs: drag them onto event fire pits. Fires
 * grow with each log; named logs stack under the pit. The same log may sit
 * under many fires at once.
 */
export function EventCampfireBoard({ permissions }: EventCampfireBoardProps) {
  const canView = permissions?.includes('note_taker.view') ?? false
  const canRecord = permissions?.includes('note_taker.record') ?? false
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    enabled: canView,
  })
  const allSessions = useMeetingSessions()
  const { linkToEvent } = useNoteTakerCommands()
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // `?campfire=<eventId>` lands from a meeting doc, so the timeline it links to
  // is already open when the page arrives.
  const [searchParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(
    searchParams.get('campfire'),
  )

  const now = useMemo(() => new Date(), [])
  const grouped = useMemo(
    () => groupEvents(eventsQuery.data?.events ?? [], now),
    [eventsQuery.data, now],
  )
  const { tone, events } = useMemo(() => selectCampfireEvents(grouped), [grouped])
  const banked = tone !== 'now'
  const yardLogs = allSessions.data ?? []

  function placeLog(sessionId: string, eventId: string) {
    const log = yardLogs.find((item) => item.id === sessionId)
    linkToEvent.mutate(
      { sessionId, eventId },
      {
        onSuccess: () => {
          setStatusMessage(
            log
              ? `“${log.title}” is on the fire (you can still use it on other fires).`
              : 'Log added to the fire.',
          )
        },
        onError: () => {
          setStatusMessage('Could not add that log to the fire.')
        },
      },
    )
  }

  if (!canView) return null

  return (
    <section
      aria-label="Meeting docs by event"
      className="on-navy overflow-hidden rounded-card border border-white/12 bg-[#0a1a12] shadow-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/12 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-ink">
            {campfireHeading(tone)}
          </h2>
          <p className="text-xs text-navy-ink-muted">
            Drag meeting logs onto a fire pit. Fires grow with each log; the same
            log can feed as many fires as you need.
          </p>
        </div>
        <span className="rounded-control bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-navy-ink-muted">
          {events.length}
        </span>
      </header>

      {canView ? (
        <LogYard
          logs={yardLogs}
          selectedLogId={selectedLogId}
          onSelect={setSelectedLogId}
          canDrag={canRecord}
        />
      ) : null}

      {statusMessage ? (
        <p className="border-b border-white/12 px-4 py-2 text-xs text-amber-100/90" role="status">
          {statusMessage}
        </p>
      ) : null}

      {eventsQuery.isPending ? (
        <p className="px-4 py-6 text-sm text-navy-ink-muted">Loading events…</p>
      ) : null}
      {eventsQuery.isError ? (
        <p className="px-4 py-6 text-sm text-navy-ink-muted">
          Could not load events. Check that the backend is running.
        </p>
      ) : null}

      {eventsQuery.data && events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-navy-ink-muted">
          No events yet, so there is no campfire to sit at. Meetings recorded
          from Tools → Note Taker still keep their audio, transcript, and note.
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul className="divide-y divide-white/10">
          {events.map((event, index) => (
            <EventCampfireRow
              key={event.id}
              event={event}
              seed={index}
              banked={banked}
              canRecord={canRecord}
              open={openId === event.id}
              onToggle={() => setOpenId(openId === event.id ? null : event.id)}
              yardLogs={yardLogs}
              selectedLogId={selectedLogId}
              onDropLog={placeLog}
              linking={linkToEvent.isPending}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
