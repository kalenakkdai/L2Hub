import type { BoardTask } from './api'

/**
 * How a due date reads today.
 *
 * `formatDueDate` deliberately stays a formatter and knows nothing about
 * lateness: it is shared with the requests log, where a done or declined
 * request with a past due date is not overdue at all. The policy lives here,
 * beside it, so the two views of the board cannot disagree while the requests
 * log keeps its own rule.
 */
export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later'

/** Anything inside this many days counts as due soon. Matches the backend. */
const SOON_DAYS = 3

export function formatDueDate(iso: string | null): string | null {
  if (!iso) return null
  // The value is a plain date; parsing it as UTC and formatting in the local
  // zone would shift it a day backwards west of Greenwich.
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Today as YYYY-MM-DD, directly comparable to the API's plain dates. */
export function todayStamp(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalDate(stamp: string): Date | null {
  const [year, month, day] = stamp.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function dueState(
  dueOn: string | null,
  today: string,
  soonDays = SOON_DAYS,
): DueState {
  if (!dueOn) return 'none'
  // Overdue and today need no arithmetic: ISO dates sort lexicographically,
  // which sidesteps every timezone question a Date would reintroduce.
  if (dueOn < today) return 'overdue'
  if (dueOn === today) return 'today'

  const due = toLocalDate(dueOn)
  const now = toLocalDate(today)
  if (!due || !now) return 'none'
  const days = Math.round((due.getTime() - now.getTime()) / 86_400_000)
  return days <= soonDays ? 'soon' : 'later'
}

/** A finished task is never late, however long ago it was due. */
export function taskDueState(task: BoardTask, today: string): DueState {
  if (task.status === 'done') return 'none'
  return dueState(task.dueOn, today)
}

export type DueLabel = {
  text: string
  tone: 'danger' | 'warning' | 'neutral'
}

/**
 * What to show beside a task, or null when there is nothing to say.
 *
 * The wording carries the meaning on its own — "Overdue", "Due today" — so
 * the colour is reinforcement rather than the only signal.
 */
export function dueLabel(task: BoardTask, today: string): DueLabel | null {
  const state = taskDueState(task, today)
  if (state === 'none') return null

  const formatted = formatDueDate(task.dueOn)
  if (!formatted) return null

  if (state === 'overdue') return { text: `Overdue · ${formatted}`, tone: 'danger' }
  if (state === 'today') return { text: 'Due today', tone: 'warning' }
  if (state === 'soon') {
    const due = toLocalDate(task.dueOn as string)
    const now = toLocalDate(today)
    const days =
      due && now ? Math.round((due.getTime() - now.getTime()) / 86_400_000) : 0
    const when = days === 1 ? 'tomorrow' : `in ${days} days`
    return { text: `Due ${when} · ${formatted}`, tone: 'warning' }
  }
  return { text: `due ${formatted}`, tone: 'neutral' }
}
