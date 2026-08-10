import { Plus } from 'lucide-react'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { BoardColumn, BoardTask } from './api'
import { OpenRequestCount } from './BoardBits'
import { TaskRow } from './TaskRow'

type CommitteeColumnProps = {
  column: BoardColumn
  onAddTask: () => void
  onReassign: (task: BoardTask) => void
  today: string
}

/** One committee as a column in the side-by-side layout. */
export function CommitteeColumn({
  column,
  onAddTask,
  onReassign,
  today,
}: CommitteeColumnProps) {
  return (
    <section className="flex w-[286px] shrink-0 flex-col rounded-card border border-border-subtle bg-surface">
      <header className="border-b border-border-divider px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{column.name}</h2>
          {column.isMine && <StatusBadge tone="accent">Yours</StatusBadge>}
        </div>
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-subtle">
          <span className="font-mono">{column.tasks.length} tasks</span>
          <OpenRequestCount count={column.openRequestCount} />
        </p>
      </header>

      {column.tasks.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-subtle">
          Nothing on the board.
        </p>
      ) : (
        <ul className="flex-1">
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

      {column.canAddTask && (
        <button
          type="button"
          onClick={onAddTask}
          className="flex items-center gap-1.5 border-t border-border-divider px-3.5 py-2.5 text-[12.5px] text-ink-muted transition hover:bg-surface-muted hover:text-accent-ink"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add task
        </button>
      )}
    </section>
  )
}
