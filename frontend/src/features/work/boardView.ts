import { TASK_STATUS_LABELS, type BoardColumn } from './api'
import { taskDueState } from './dueDates'

/**
 * How the board is laid out.
 *
 * `expanded` is the original side-by-side strip of columns. `compact` puts
 * every committee on one screen as a collapsible row, which is the view the
 * board was always for — with eight committees the far end of the strip is
 * off the edge of the screen.
 *
 * Deliberately not called "density": a global `compact_density` profile
 * setting already exists and rescales the whole app's spacing. Two different
 * ideas, so two different words.
 */
export type BoardViewMode = 'expanded' | 'compact'

export const DEFAULT_BOARD_VIEW: BoardViewMode = 'expanded'

export const BOARD_VIEW_LABELS: Record<BoardViewMode, string> = {
  expanded: 'Expanded',
  compact: 'Compact',
}

/** Anything unrecognised falls back rather than throwing, so a stale or
 *  hand-edited link renders the board instead of a blank page. */
export function parseViewMode(value: string | null): BoardViewMode {
  return value === 'compact' ? 'compact' : DEFAULT_BOARD_VIEW
}

export type BoardSummary = {
  total: number
  todo: number
  doing: number
  done: number
  overdue: number
  dueSoon: number
  /** "5 tasks · 2 in progress · 1 done", or "No tasks". */
  text: string
}

/**
 * The one-line reading of a committee, for a collapsed row.
 *
 * Pure so the counting is testable without rendering anything, and so the
 * compact row stays markup.
 */
export function summarizeColumn(column: BoardColumn, today: string): BoardSummary {
  let todo = 0
  let doing = 0
  let done = 0
  let overdue = 0
  let dueSoon = 0

  for (const task of column.tasks) {
    if (task.status === 'todo') todo += 1
    else if (task.status === 'doing') doing += 1
    else done += 1

    const state = taskDueState(task, today)
    if (state === 'overdue') overdue += 1
    else if (state === 'today' || state === 'soon') dueSoon += 1
  }

  const total = column.tasks.length
  const segments: string[] = []
  if (total > 0) segments.push(total === 1 ? '1 task' : `${total} tasks`)
  // Only the non-zero parts, and labelled from TASK_STATUS_LABELS so the
  // wording can never drift from the status buttons on the tasks themselves.
  if (doing > 0) segments.push(`${doing} ${TASK_STATUS_LABELS.doing.toLowerCase()}`)
  if (done > 0) segments.push(`${done} ${TASK_STATUS_LABELS.done.toLowerCase()}`)

  return {
    total,
    todo,
    doing,
    done,
    overdue,
    dueSoon,
    text: total === 0 ? 'No tasks' : segments.join(' · '),
  }
}
