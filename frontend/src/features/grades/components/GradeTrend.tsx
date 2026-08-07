import {
  CartesianGrid,
  Line,
  LineChart,
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
            Cumulative score across graded assignments
          </p>
        </div>
        <p className="text-xl font-semibold tabular-nums text-ink">
          {currentGrade}%
        </p>
      </div>

      <div className="h-56 w-full" aria-label={`Current grade ${currentGrade}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
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
