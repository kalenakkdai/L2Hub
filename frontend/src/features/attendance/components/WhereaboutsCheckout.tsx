import { useState } from 'react'
import type { WhereaboutsEntry, WhereaboutsKind } from '../types'

const DESTINATIONS = [
  ['bathroom', 'Bathroom'],
  ['office', 'Main office'],
  ['student_store', 'Student store'],
  ['library', 'Library'],
  ['gym', 'Gym'],
  ['cafeteria', 'Cafeteria'],
  ['parking_lot', 'Parking lot'],
  ['other', 'Other'],
] as const

type WhereaboutsCheckoutProps = {
  entries: WhereaboutsEntry[]
  busy: boolean
  onCheckout: (input: {
    kind: WhereaboutsKind
    destinationKey: string
    studentId?: string
    customName?: string
    customDestination?: string
    taskName?: string
  }) => void
  onReturn: (entryId: string) => void
}

export function WhereaboutsCheckout({
  entries,
  busy,
  onCheckout,
  onReturn,
}: WhereaboutsCheckoutProps) {
  const [kind, setKind] = useState<WhereaboutsKind>('bathroom')
  const [studentId, setStudentId] = useState('')
  const [customName, setCustomName] = useState('')
  const [destinationKey, setDestinationKey] = useState('bathroom')
  const [customDestination, setCustomDestination] = useState('')
  const [taskName, setTaskName] = useState('')

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <h2 className="text-sm font-semibold text-ink">Bathroom & errand checkout</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Scan/type an ID for students. Errands may use a typed name.
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          onCheckout({
            kind,
            destinationKey,
            studentId: studentId || undefined,
            customName: customName || undefined,
            customDestination: customDestination || undefined,
            taskName: taskName || undefined,
          })
          setStudentId('')
          setCustomName('')
          setTaskName('')
        }}
      >
        <label className="text-xs font-medium text-ink-muted">
          Type
          <select
            value={kind}
            onChange={(event) => {
              const next = event.target.value as WhereaboutsKind
              setKind(next)
              if (next === 'bathroom') setDestinationKey('bathroom')
            }}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="bathroom">Bathroom</option>
            <option value="errand">Errand</option>
          </select>
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Student ID {kind === 'errand' ? '(optional)' : ''}
          <input
            required={kind === 'bathroom'}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            inputMode="numeric"
          />
        </label>
        {kind === 'errand' ? (
          <label className="text-xs font-medium text-ink-muted">
            Name if no student ID
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label className="text-xs font-medium text-ink-muted">
          Destination
          <select
            value={destinationKey}
            onChange={(event) => setDestinationKey(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            {DESTINATIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {destinationKey === 'other' ? (
          <label className="text-xs font-medium text-ink-muted">
            Custom destination
            <input
              value={customDestination}
              onChange={(event) => setCustomDestination(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label className="text-xs font-medium text-ink-muted sm:col-span-2">
          Task / what they are picking up
          <input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={
            busy ||
            (kind === 'bathroom' && studentId.length < 4) ||
            (kind === 'errand' && !studentId && !customName.trim())
          }
          className="rounded-control bg-accent-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
        >
          Check out
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-sunken px-3 py-2"
          >
            <span>
              <span className="block text-sm font-semibold text-ink">
                {entry.displayName}
              </span>
              <span className="block text-xs text-ink-muted">
                {entry.kind} · {entry.customDestination ?? entry.destinationKey}
                {entry.taskName ? ` · ${entry.taskName}` : ''}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReturn(entry.id)}
              className="rounded-control border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink"
            >
              Mark back
            </button>
          </li>
        ))}
        {entries.length === 0 ? (
          <li className="text-xs text-ink-muted">Everyone is in the room.</li>
        ) : null}
      </ul>
    </section>
  )
}
