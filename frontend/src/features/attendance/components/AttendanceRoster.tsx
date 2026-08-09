import { useEffect, useState } from 'react'
import type { AttendanceRecord, AttendanceStatus } from '../types'

const STATUSES: AttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'excused',
  'under_80',
]

function statusLabel(status: AttendanceStatus): string {
  if (status === 'under_80') return 'Under 80%'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

type AttendanceRosterProps = {
  records: AttendanceRecord[]
  saving: boolean
  onSave: (
    recordId: string,
    input: {
      status: AttendanceStatus
      scorePercent: number
      presentPercent: number
      note: string
    },
  ) => void
}

export function AttendanceRoster({
  records,
  saving,
  onSave,
}: AttendanceRosterProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = records.find((record) => record.id === editingId) ?? null
  const [status, setStatus] = useState<AttendanceStatus>('present')
  const [score, setScore] = useState(100)
  const [present, setPresent] = useState(100)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!editing) return
    setStatus(editing.status)
    setScore(editing.scorePercent)
    setPresent(editing.presentPercent)
    setNote(editing.manualNote ?? '')
  }, [editing])

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Today’s roster</h2>
          <p className="text-xs text-ink-muted">
            Red halos mark students below 80% after the day closes.
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-muted">{records.length}</span>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {records.map((record) => (
          <li key={record.id}>
            <button
              type="button"
              onClick={() => setEditingId(record.id)}
              className={`w-full rounded-control border bg-surface px-3 py-2 text-left transition ${
                record.needsAttention
                  ? 'border-status-danger shadow-[0_0_0_3px_rgb(239_68_68/0.28),0_0_18px_rgb(239_68_68/0.35)]'
                  : editingId === record.id
                    ? 'border-accent-600'
                    : 'border-border-subtle hover:border-border-strong'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {record.displayName}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-ink-muted">
                  {statusLabel(record.status)}
                </span>
              </span>
              <span className="mt-1 block text-xs text-ink-subtle">
                {record.checkedInAt
                  ? `In ${new Date(record.checkedInAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'Not checked in'}
                {' · '}
                score {record.scorePercent}%
                {record.status === 'under_80'
                  ? ` · present ${record.presentPercent}%`
                  : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <form
          className="mt-4 rounded-control border border-border-subtle bg-surface-sunken p-3"
          onSubmit={(event) => {
            event.preventDefault()
            onSave(editing.id, {
              status,
              scorePercent: score,
              presentPercent: present,
              note,
            })
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Edit {editing.displayName}
            </h3>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-xs text-ink-muted hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-ink-muted">
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as AttendanceStatus)
                }
                className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-2 text-sm text-ink"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Attendance score
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(event) => setScore(Number(event.target.value))}
                className="mt-1 w-full rounded-control border border-border-strong px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Present %
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={present}
                onChange={(event) => setPresent(Number(event.target.value))}
                className="mt-1 w-full rounded-control border border-border-strong px-2 py-2 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-ink-muted">
            Manual edit reason
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-2 py-2 text-sm"
              placeholder="Excused absence, counselor appointment…"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-control bg-navy-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save attendance edit
          </button>
        </form>
      ) : null}
    </section>
  )
}
