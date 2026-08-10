import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, MapPinned, MessageSquareText } from 'lucide-react'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAttendanceCommands, useWhereabouts } from '../hooks'
import type { WhereaboutsEntry } from '../types'
import campusMap from '../assets/msjhs-campus-map.png'
import { initials } from '../../../lib/initials'

type Point = { x: number; y: number; label: string }

/**
 * Declared destinations plotted on the MSJHS campus map. Coordinates are
 * percentages of the map image (schematic building locations), not GPS.
 */
const DESTINATIONS: Record<string, Point> = {
  classroom: { x: 26, y: 40, label: 'Leadership classroom' },
  bathroom: { x: 60, y: 44, label: 'Bathroom' },
  office: { x: 38, y: 79, label: 'Main office' },
  student_store: { x: 40, y: 69, label: 'Student store' },
  library: { x: 37, y: 60, label: 'Library' },
  gym: { x: 42, y: 42, label: 'Gymnasium' },
  cafeteria: { x: 55, y: 43, label: 'Snack bar / kitchen' },
  parking_lot: { x: 16, y: 39, label: 'Parking lot' },
  other: { x: 66, y: 62, label: 'Other destination' },
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
              className="relative aspect-[887/678] min-h-[440px] overflow-hidden rounded-card border border-border-subtle bg-white shadow-card"
            >
              <img
                src={campusMap}
                alt="Mission San Jose High School campus map"
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />

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
                <div className="absolute inset-0 flex items-center justify-center bg-white/35 text-sm font-bold text-ink-muted backdrop-blur-[1px]">
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
