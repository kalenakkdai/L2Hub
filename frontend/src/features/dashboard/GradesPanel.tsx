import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn } from '../../components/ui/cn'
import { letterGrade } from '../grades/utils/letterGrade'
import type { GradeRow, GradesOverview } from './types'

const BAND_FILL: Record<NonNullable<GradeRow['band']>, string> = {
  'a-plus': 'bg-grade-a-plus',
  a: 'bg-grade-a',
  'a-minus': 'bg-grade-a-minus',
  bc: 'bg-grade-bc',
  'below-c': 'bg-grade-below-c',
}

function Score({ row }: { row: GradeRow }) {
  if (row.earned === null) {
    return (
      <span className="justify-self-end font-mono text-[12.5px] text-ink-faint">
        — / {row.possible}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'justify-self-end inline-flex min-w-[66px] items-center justify-center rounded-[5px] px-2.5 py-1 font-mono text-xs font-medium text-ink',
        row.band ? BAND_FILL[row.band] : 'bg-surface-muted',
      )}
    >
      {row.earned} / {row.possible}
    </span>
  )
}

function Tile({
  value,
  label,
  tone = 'ink',
}: {
  value: string
  label: string
  tone?: 'ink' | 'danger' | 'warning'
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div
        className={cn(
          'text-[22px] font-semibold tracking-[-0.02em]',
          tone === 'danger' && 'text-status-danger',
          tone === 'warning' && 'text-status-warning',
          tone === 'ink' && 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[12.5px] text-ink-subtle">{label}</div>
    </div>
  )
}

const COLUMNS = 'grid-cols-[1fr_92px] sm:grid-cols-[1fr_148px_104px_92px]'

export function GradesPanel({ grades }: { grades: GradesOverview }) {
  const percent =
    grades.pointsPossible > 0
      ? Math.round((grades.pointsEarned / grades.pointsPossible) * 100)
      : 0
  const letter =
    grades.pointsPossible > 0 ? letterGrade(percent) : null

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border-subtle bg-border-subtle sm:grid-cols-4">
        <Tile value={String(grades.completed)} label="Completed" />
        <Tile value={String(grades.missing)} label="Missing" tone="danger" />
        <Tile value={String(grades.open)} label="Open" tone="warning" />
        <Tile
          value={letter ?? '—'}
          label={
            grades.pointsPossible > 0
              ? `Grade · ${percent}% · ${grades.pointsEarned}/${grades.pointsPossible}`
              : 'Grade · 0%'
          }
        />
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div
          className={cn(
            'grid gap-4 border-b border-border-divider bg-surface-sunken px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] text-ink-subtle uppercase',
            COLUMNS,
          )}
        >
          <span>Assignment</span>
          <span className="hidden sm:block">Event</span>
          <span className="hidden sm:block">Status</span>
          <span className="justify-self-end">Score</span>
        </div>

        <ul>
          {grades.rows.map((row) => (
            <li key={row.id}>
              <Link
                to="/grades"
                className={cn(
                  'grid items-center gap-4 border-b border-border-divider px-4 py-3 text-[13.5px] text-ink transition duration-[260ms] ease-out-quick last:border-b-0 hover:translate-x-0.5 hover:bg-surface-muted',
                  COLUMNS,
                )}
              >
                <span className="min-w-0 truncate font-medium">{row.assignment}</span>
                <span className="hidden truncate text-ink-subtle sm:block">
                  {row.event ?? '—'}
                </span>
                <span className="hidden sm:block">
                  <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
                </span>
                <Score row={row} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
