import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, MapPinned, MessageSquareText } from 'lucide-react'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAttendanceCommands, useWhereabouts } from '../hooks'
import type { WhereaboutsEntry } from '../types'

type Point = { x: number; y: number; label: string }

/** Schematic campus destinations, not GPS coordinates. */
const DESTINATIONS: Record<string, Point> = {
  classroom: { x: 24, y: 32, label: 'Leadership classroom' },
  bathroom: { x: 38, y: 28, label: 'Bathroom' },
  office: { x: 50, y: 18, label: 'Main office' },
  student_store: { x: 64, y: 30, label: 'Student store' },
  library: { x: 78, y: 24, label: 'Library' },
  gym: { x: 79, y: 70, label: 'Gym' },
  cafeteria: { x: 54, y: 67, label: 'Cafeteria' },
  parking_lot: { x: 15, y: 78, label: 'Parking lot' },
  other: { x: 42, y: 82, label: 'Other destination' },
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function pointFor(entry: WhereaboutsEntry, index: number): Point {
  const point = DESTINATIONS[entry.destinationKey] ?? DESTINATIONS.other
  // Keep multiple people at one destination individually hoverable.
  const angle = index * 2.4
  return {
    ...point,
    x: point.x + Math.cos(angle) * Math.min(4, index * 1.2),
    y: point.y + Math.sin(angle) * Math.min(4, index * 1.2),
  }
}

export function WhereaboutsMapPage() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const me = meQuery.data
  const canView = Boolean(
    me &&
      (hasPermission(me, 'attendance.view_all') ||
        hasPermission(me, 'attendance.view_committee')),
  )
  const entries = useWhereabouts(canView)
  const { ping } = useAttendanceCommands()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const selected =
    entries.data?.find((entry) => entry.id === selectedId) ?? entries.data?.[0]

  const plotted = useMemo(() => {
    const destinationCounts = new Map<string, number>()
    return (entries.data ?? []).map((entry) => {
      const count = destinationCounts.get(entry.destinationKey) ?? 0
      destinationCounts.set(entry.destinationKey, count + 1)
      return { entry, point: pointFor(entry, count) }
    })
  }, [entries.data])

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !me) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      {!canView ? (
        <ErrorState
          variant="unauthorized"
          title="Whereabouts map restricted"
          description="This map is available to Jan, ASBO, and committee heads for their scoped members."
        />
      ) : (
        <>
          <header className="mb-5 border-b border-border-subtle pb-4">
            <h1 className="flex items-center gap-2 text-display font-semibold text-ink">
              <MapPinned size={24} aria-hidden="true" />
              MSJHS whereabouts map
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Declared bathroom and errand destinations — not background GPS
              tracking. Committee heads only receive entries allowed by their
              committee scope.
            </p>
          </header>

          {entries.isError ? (
            <ErrorState
              title="Could not load whereabouts"
              description="Your role may not have access to this map."
              onRetry={() => void entries.refetch()}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section
              aria-label="MSJHS campus map"
              className="relative aspect-[16/10] min-h-[440px] overflow-hidden rounded-card border border-border-subtle bg-[#e9efe5] shadow-card"
            >
              <svg
                viewBox="0 0 100 62.5"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <rect width="100" height="62.5" fill="#dbe8d4" />
                <path
                  d="M0 48 C20 43 32 51 49 46 S76 42 100 48 V62.5 H0Z"
                  fill="#b8d3ad"
                />
                <g fill="#f4eee1" stroke="#9c8f7a" strokeWidth="0.45">
                  <rect x="14" y="10" width="27" height="18" rx="1" />
                  <rect x="45" y="6" width="20" height="15" rx="1" />
                  <rect x="69" y="9" width="22" height="18" rx="1" />
                  <rect x="18" y="34" width="25" height="13" rx="1" />
                  <rect x="48" y="34" width="19" height="15" rx="1" />
                  <rect x="72" y="35" width="21" height="16" rx="1" />
                </g>
                <g
                  fill="#53655b"
                  fontSize="2.1"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  <text x="27.5" y="19.5">CLASSROOMS</text>
                  <text x="55" y="14">OFFICE</text>
                  <text x="80" y="19">LIBRARY / STORE</text>
                  <text x="30.5" y="41.5">STUDENT CENTER</text>
                  <text x="57.5" y="42">CAFETERIA</text>
                  <text x="82.5" y="43.5">GYM</text>
                </g>
                <path
                  d="M7 31 H93 M44 3 V56 M68 3 V56"
                  stroke="#eef2eb"
                  strokeWidth="2.6"
                  fill="none"
                />
              </svg>

              {plotted.map(({ entry, point }) => (
                <button
                  key={entry.id}
                  type="button"
                  title={`${entry.displayName} · ${
                    entry.taskName || entry.customDestination || point.label
                  }`}
                  aria-label={`${entry.displayName} at ${point.label}`}
                  onClick={() => setSelectedId(entry.id)}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg transition hover:scale-110 ${
                    selected?.id === entry.id
                      ? 'border-white bg-accent-700 text-white ring-4 ring-accent-400/40'
                      : 'border-white bg-navy-900 text-white'
                  }`}
                >
                  {initials(entry.displayName)}
                </button>
              ))}

              {entries.data?.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/35 text-sm font-medium text-ink-muted backdrop-blur-[1px]">
                  Everyone is in the room.
                </div>
              ) : null}
            </section>

            <aside className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              {selected ? (
                <>
                  <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                    Current whereabouts
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {selected.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {selected.customDestination ??
                      DESTINATIONS[selected.destinationKey]?.label ??
                      selected.destinationKey}
                  </p>
                  {selected.taskName ? (
                    <p className="mt-3 rounded-control bg-surface-sunken p-3 text-sm text-ink">
                      {selected.taskName}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-subtle">
                    Left{' '}
                    {new Date(selected.leftAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>

                  {selected.profileId ? (
                    <form
                      className="mt-4 border-t border-border-subtle pt-4"
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (!message.trim()) return
                        void ping
                          .mutateAsync({
                            entryId: selected.id,
                            message: message.trim(),
                          })
                          .then((result) => {
                            setMessage('')
                            if (result.smsUrl) window.location.href = result.smsUrl
                          })
                      }}
                    >
                      <label className="text-xs font-semibold text-ink-muted">
                        Ping message
                        <textarea
                          rows={3}
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
                          placeholder="Please pick up the Spirit posters on your way back."
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={ping.isPending || !message.trim()}
                        className="mt-2 inline-flex items-center gap-2 rounded-control bg-accent-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {selected.canSms ? (
                          <MessageSquareText size={15} aria-hidden="true" />
                        ) : (
                          <BellRing size={15} aria-hidden="true" />
                        )}
                        {selected.canSms
                          ? 'Notify & open SMS'
                          : 'Send in-app notification'}
                      </button>
                      <p className="mt-2 text-[11px] text-ink-subtle">
                        L2 Hub sends the in-app notification immediately. SMS
                        opens the device composer for review; it is not silently
                        sent by the website.
                      </p>
                    </form>
                  ) : (
                    <p className="mt-4 text-xs text-ink-muted">
                      Typed-name errands are logged but cannot be messaged until
                      linked to a student account.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Select an initial on the map.
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </AppShell>
  )
}
