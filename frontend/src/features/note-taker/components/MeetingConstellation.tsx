import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEIGHT, layoutConstellation, weightForStatus } from '../lib/constellation'
import { statusLabel } from '../lib/statusLabel'
import type { MeetingSessionSummary } from '../types'

function shortDate(value: string | null): string {
  if (!value) return 'No date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No date'
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Star labels have no room for a full doc name. */
function truncate(value: string, max = 18): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

type MeetingConstellationProps = {
  sessions: MeetingSessionSummary[]
  canRename: boolean
  renaming: boolean
  onRename: (sessionId: string, title: string) => void
}

/**
 * Meeting docs for one event, drawn as a constellation.
 *
 * Oldest meeting sits leftmost so the line through the stars is the event's
 * timeline. Selecting a star opens its card, where the auto-generated name can
 * be replaced.
 */
export function MeetingConstellation({
  sessions,
  canRename,
  renaming,
  onRename,
}: MeetingConstellationProps) {
  const ordered = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const left = Date.parse(a.createdAt ?? '') || 0
        const right = Date.parse(b.createdAt ?? '') || 0
        return left - right
      }),
    [sessions],
  )

  const layout = useMemo(
    () =>
      layoutConstellation(
        ordered.map((session) => ({
          id: session.id,
          weight: weightForStatus(session.status),
        })),
      ),
    [ordered],
  )

  const [selectedId, setSelectedId] = useState<string | null>(
    ordered.at(-1)?.id ?? null,
  )
  const selected =
    ordered.find((session) => session.id === selectedId) ?? ordered.at(-1) ?? null

  const [draftTitle, setDraftTitle] = useState(selected?.title ?? '')
  // Follow the selection, and pick up a rename that landed on the server.
  useEffect(() => {
    setDraftTitle(selected?.title ?? '')
  }, [selected?.id, selected?.title])

  if (ordered.length === 0) {
    return (
      <p className="px-4 py-4 text-xs text-navy-ink-muted">
        No meeting docs filed yet. Record a meeting and it lands here as a star on
        this event&rsquo;s timeline.
      </p>
    )
  }

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={HEIGHT}
          role="group"
          aria-label="Meeting doc timeline"
          className="max-w-none"
        >
          {layout.links.map((link) => (
            <line
              key={`${link.fromId}-${link.toId}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke="rgba(226,232,240,0.35)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}

          {layout.stars.map((star) => {
            const session = ordered[star.index]
            const isSelected = session.id === selected?.id
            return (
              <g
                key={star.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Meeting ${star.index + 1}: ${session.title}`}
                className="cursor-pointer focus:outline-none"
                onClick={() => setSelectedId(session.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId(session.id)
                  }
                }}
              >
                <circle
                  cx={star.x}
                  cy={star.y}
                  r={star.radius + 7}
                  fill={isSelected ? 'rgba(253,224,71,0.22)' : 'rgba(253,224,71,0.08)'}
                />
                <circle
                  cx={star.x}
                  cy={star.y}
                  r={star.radius}
                  fill={session.status === 'failed' ? '#fca5a5' : '#fde68a'}
                  stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text
                  x={star.x}
                  y={star.y - star.radius - 10}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill="#fef3c7"
                >
                  {shortDate(session.createdAt)}
                </text>
                <text
                  x={star.x}
                  y={star.y + star.radius + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#e2e8f0"
                >
                  {truncate(session.title)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {selected ? (
        <div className="rounded-control border border-white/12 bg-white/[0.06] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-navy-ink">{selected.title}</p>
            <p className="text-[11px] text-navy-ink-muted">
              {statusLabel(selected.status)} · {shortDate(selected.createdAt)}
            </p>
          </div>

          {canRename ? (
            <form
              className="mt-2 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const next = draftTitle.trim()
                if (!next || next === selected.title) return
                onRename(selected.id, next)
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Rename meeting doc</span>
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="w-full rounded-control border border-white/20 bg-black/25 px-2 py-1.5 text-xs text-navy-ink placeholder:text-navy-ink-muted"
                />
              </label>
              <button
                type="submit"
                disabled={renaming || !draftTitle.trim()}
                className="rounded-control bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-navy-ink hover:bg-white/25 disabled:opacity-50"
              >
                Rename
              </button>
            </form>
          ) : null}

          <Link
            to={`/note-taker/${selected.id}`}
            className="mt-2 inline-block text-xs font-semibold text-accent-300 hover:underline"
          >
            Open meeting doc →
          </Link>
        </div>
      ) : null}
    </div>
  )
}
