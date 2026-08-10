import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList, Loader } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchMyTasks,
  TASK_STATUS_LABELS,
  type BoardTask,
  type MyTasksCampfire,
} from './api'
import { CampfireRing } from './CampfireRing'
import { FlyingOwl, type OwlPoint } from './FlyingOwl'
import { ProgressBar } from './ProgressBar'

/**
 * My Tasks: a rotating ring of event campfires. Pick a fire, the owl flies
 * over, then you see your work and how far everyone else is.
 */
export function MyTasksPage() {
  const me = useCurrentUser()
  const query = useQuery({ queryKey: ['tasks', 'mine'], queryFn: fetchMyTasks })
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [flight, setFlight] = useState<{
    key: number
    from: OwlPoint
    to: OwlPoint
  } | null>(null)

  const campfires = query.data?.campfires ?? []
  const selected = useMemo(
    () => campfires.find((c) => c.event.id === selectedId) ?? null,
    [campfires, selectedId],
  )

  const onArrived = useCallback(() => setPanelOpen(true), [])

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const pickFire = (campfire: MyTasksCampfire, point: OwlPoint) => {
    const stage = stageRef.current
    const from: OwlPoint = stage
      ? { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }
      : { x: 200, y: 200 }

    setSelectedId(campfire.event.id)
    setPanelOpen(false)
    setFlight({
      key: (flight?.key ?? 0) + 1,
      from: flight?.to ?? from,
      to: point,
    })
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title font-semibold text-ink">My tasks</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Press a campfire. The owl flies over, then you see your work and how
          far everyone else is.
        </p>
      </div>
      {query.data ? (
        <p className="text-sm tabular-nums text-ink-subtle">
          {query.data.openTaskCount} open
        </p>
      ) : null}
    </div>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      {query.isPending ? (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Gathering campfires…
        </p>
      ) : null}

      {query.isError ? (
        <ErrorState
          title="Could not load your tasks"
          description="The campfires did not come back. Try again in a moment."
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data &&
      campfires.length === 0 &&
      query.data.unlinkedTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No campfires yet"
          description="When an event is happening or about to start, its fire appears here with your tasks."
        />
      ) : null}

      {query.data && campfires.length > 0 ? (
        <section className="relative overflow-hidden rounded-card border border-border-subtle bg-[#0f1724] px-4 py-8 shadow-xs sm:px-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.18),transparent_55%),linear-gradient(180deg,#0b1220_0%,#162033_55%,#1a1520_100%)]"
          />
          <div className="relative" ref={stageRef}>
            <p className="mb-4 text-center text-xs font-semibold tracking-wide text-amber-100/70 uppercase">
              {campfires.some((c) => c.tone === 'now')
                ? 'Happening now'
                : 'Starting soon'}
            </p>

            <div className="relative">
              <CampfireRing
                campfires={campfires}
                selectedId={selectedId}
                paused={panelOpen || flight != null}
                onSelect={pickFire}
              />
              {flight ? (
                <FlyingOwl
                  flightKey={flight.key}
                  from={flight.from}
                  to={flight.to}
                  onArrived={onArrived}
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {panelOpen && selected ? (
        <CampfireTasks
          campfire={selected}
          onBack={() => {
            setPanelOpen(false)
            setSelectedId(null)
            setFlight(null)
          }}
        />
      ) : null}

      {query.data && query.data.unlinkedTasks.length > 0 && !panelOpen ? (
        <section className="mt-6 rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">Tasks without an event</h2>
          <ul className="mt-3 space-y-2">
            {query.data.unlinkedTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  )
}

function CampfireTasks({
  campfire,
  onBack,
}: {
  campfire: MyTasksCampfire
  onBack: () => void
}) {
  return (
    <section className="mt-6 space-y-5 rounded-card border border-border-subtle bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to campfires
          </button>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            {campfire.event.name}{' '}
            <span className="text-ink-subtle">{campfire.event.year}</span>
          </h2>
        </div>
        <div className="min-w-[12rem] flex-1 sm:max-w-xs">
          <ProgressBar
            accent
            percent={campfire.progress.percentComplete}
            label="Event progress"
            detail={`${campfire.progress.done}/${campfire.progress.total}`}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          Your tasks
        </h3>
        {campfire.myTasks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Nothing assigned to you on this fire yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {campfire.myTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          Everyone&apos;s progress
        </h3>
        {campfire.assignees.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No tasks are linked to this event yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {campfire.assignees.map((person) => (
              <li key={person.id ?? person.name}>
                <ProgressBar
                  accent={person.isMe}
                  percent={person.percentComplete}
                  label={person.isMe ? `${person.name} (you)` : person.name}
                  detail={`${person.done}/${person.total}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TaskRow({ task }: { task: BoardTask }) {
  return (
    <li className="rounded-control border border-border-subtle px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{task.title}</p>
        <span className="text-xs text-ink-subtle">
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>
      {task.details ? (
        <p className="mt-1 text-xs text-ink-muted">{task.details}</p>
      ) : null}
      {task.dueOn ? (
        <p className="mt-1 text-xs text-ink-subtle">Due {task.dueOn}</p>
      ) : null}
    </li>
  )
}
