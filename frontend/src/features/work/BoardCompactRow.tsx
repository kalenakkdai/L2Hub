import { AlertTriangle, ChevronRight, Clock, Plus } from 'lucide-react'
import { cn } from '../../components/ui/cn'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { BoardColumn, BoardTask } from './api'
import { OpenRequestCount } from './BoardBits'
import { summarizeColumn } from './boardView'
import { TaskRow } from './TaskRow'

type BoardCompactRowProps = {
  column: BoardColumn
  open: boolean
  onToggle: () => void
  onAddTask: () => void
  onReassign: (task: BoardTask) => void
  today: string
}

/**
 * One committee as a full-width row, with its tasks folded away.
 *
 * This is the layout the board was always for: eight committees side by side
 * in 286px columns puts half of Leadership 2 off the edge of the screen, and
 * the whole point is seeing everyone at once.
 */
export function BoardCompactRow({
  column,
  open,
  onToggle,
  onAddTask,
  onReassign,
  today,
}: BoardCompactRowProps) {
  const panelId = `board-committee-${column.id}`
  const summary = summarizeColumn(column, today)

  return (
    <li className="border-b border-border-divider last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        {/* The heading wraps the control, so the committee is still a
            landmark to jump between in this layout as well as the other. */}
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex w-full min-w-0 items-start gap-2.5 rounded-control text-left"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-200 ease-out-quick',
                open && 'rotate-90',
              )}
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-sm font-semibold text-ink">
                  {column.name}
                </span>
                {column.isMine && <StatusBadge tone="accent">Yours</StatusBadge>}
                {/* Overdue suppresses due-soon: one warning per row, so a
                    glance down the list ranks committees rather than
                    presenting two competing numbers. */}
                {summary.overdue > 0 ? (
                  <StatusBadge tone="danger" icon={AlertTriangle}>
                    {summary.overdue} overdue
                  </StatusBadge>
                ) : (
                  summary.dueSoon > 0 && (
                    <StatusBadge tone="warning" icon={Clock}>
                      {summary.dueSoon} due soon
                    </StatusBadge>
                  )
                )}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-normal text-ink-subtle">
                <span className="font-mono">{summary.text}</span>
                <OpenRequestCount count={column.openRequestCount} />
              </span>
            </span>
          </button>
        </h2>

        {/* A sibling of the disclosure, never nested inside it. */}
        {column.canAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="flex shrink-0 items-center gap-1.5 rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted transition hover:border-accent-600 hover:text-accent-ink"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add task
          </button>
        )}
      </div>

      {/* `hidden` rather than unmounting, so aria-controls always points at
          something real. This wrapper must carry no display utility — a
          `flex` or `grid` class here would beat [hidden] { display: none }
          and leak every collapsed task into the accessibility tree. */}
      <div id={panelId} hidden={!open}>
        {column.tasks.length === 0 ? (
          <p className="border-t border-border-divider bg-surface-sunken px-4 py-5 text-[12.5px] text-ink-subtle">
            Nothing on the board.
          </p>
        ) : (
          <ul className="border-t border-border-divider bg-surface-sunken sm:pl-6">
            {column.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canEdit={column.canAddTask}
                today={today}
                onReassign={onReassign}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
