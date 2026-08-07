import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GradebookEntry } from '../types'

interface TrendPoint {
  assignment: string
  date: string
  grade: number
}

const GRADE_BANDS = [
  { label: 'A+', min: 97, max: 100, color: 'var(--color-grade-a-plus)' },
  { label: 'A', min: 93, max: 97, color: 'var(--color-grade-a)' },
  { label: 'A−', min: 90, max: 93, color: 'var(--color-grade-a-minus)' },
  { label: 'B–C', min: 70, max: 90, color: 'var(--color-grade-bc)' },
  { label: 'Below C', min: 0, max: 70, color: 'var(--color-grade-below-c)' },
] as const

function buildGradeTrend(entries: GradebookEntry[]): TrendPoint[] {
  let earned = 0
  let possible = 0

  return entries
    .filter(
      (entry) =>
        entry.status !== 'excused' &&
        typeof entry.score === 'number' &&
        typeof entry.pointsPossible === 'number' &&
        entry.pointsPossible > 0,
    )
    .sort((a, b) => {
      const aDate = a.gradedAt ?? a.submittedAt ?? a.dueAt ?? ''
      const bDate = b.gradedAt ?? b.submittedAt ?? b.dueAt ?? ''
      return aDate.localeCompare(bDate)
    })
    .map((entry) => {
      earned += entry.score ?? 0
      possible += entry.pointsPossible ?? 0
      const timestamp = entry.gradedAt ?? entry.submittedAt ?? entry.dueAt

      return {
        assignment: entry.assignmentTitle,
        date: timestamp
          ? new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(timestamp))
          : '—',
        grade: Math.round((earned / possible) * 1000) / 10,
      }
    })
}

export function GradeTrend({ entries }: { entries: GradebookEntry[] }) {
  const data = buildGradeTrend(entries)

  if (data.length === 0) return null

  const currentGrade = data.at(-1)?.grade ?? 0

  return (
    <section
      className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
      aria-labelledby="grade-trend-title"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 id="grade-trend-title" className="text-base font-semibold text-ink">
            Grade trend
          </h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Cumulative score across graded assignments. A grades are green,
            B–C grades are yellow, and lower grades are red.
          </p>
        </div>
        <p className="text-xl font-semibold tabular-nums text-ink">
          {currentGrade}%
        </p>
      </div>

      <ul
        className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted"
        aria-label="Grade range color key"
      >
        {GRADE_BANDS.map((band) => (
          <li key={band.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-border-subtle"
              style={{ backgroundColor: band.color }}
              aria-hidden="true"
            />
            {band.label}
          </li>
        ))}
      </ul>

      <div className="h-56 w-full" aria-label={`Current grade ${currentGrade}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            {GRADE_BANDS.map((band) => (
              <ReferenceArea
                key={band.label}
                y1={band.min}
                y2={band.max}
                fill={band.color}
                fillOpacity={0.72}
                ifOverflow="hidden"
              />
            ))}
            <CartesianGrid stroke="#e3e6eb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#667085', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#667085', fontSize: 11 }}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, 'Cumulative grade']}
              labelFormatter={(_, payload) =>
                payload[0]?.payload?.assignment ?? ''
              }
            />
            <Line
              type="monotone"
              dataKey="grade"
              stroke="#047857"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#047857', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
