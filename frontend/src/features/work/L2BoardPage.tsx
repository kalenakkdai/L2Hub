import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useCurrentUser } from '../../auth/useCurrentUser'
import {
  fetchBoard,
  fetchBoardCommittees,
  updateTask,
  TASK_STATUS_LABELS,
  type BoardColumn,
  type BoardTask,
  type TaskStatus,
} from './api'
import { formatDueDate } from './RequestBits'
import { NewTaskDialog } from './NewTaskDialog'

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
}

function TaskRow({ task, canEdit }: { task: BoardTask; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const advance = useMutation({
    mutationFn: () => updateTask(task.id, { status: NEXT_STATUS[task.status] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  })

  const due = formatDueDate(task.dueOn)

  return (
    <li className="border-b border-border-divider px-3.5 py-3 last:border-b-0">
      <p
        className={
          task.status === 'done'
            ? 'text-[13.5px] text-ink-subtle line-through'
            : 'text-[13.5px] text-ink'
        }
      >
        {task.title}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-subtle">
        <span>{task.assignee?.name ?? 'Unassigned'}</span>
        {due && <span>· due {due}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {canEdit ? (
          // The status cycles on click: three states do not need a menu, and
          // the label always names the state it is in, not the next one.
          <button
            type="button"
            onClick={() => advance.mutate()}
            disabled={advance.isPending}
            aria-label={`${task.title} — ${TASK_STATUS_LABELS[task.status]}. Move to ${TASK_STATUS_LABELS[NEXT_STATUS[task.status]]}`}
            className="rounded-[5px] border border-border-subtle px-2 py-0.5 text-xs font-medium text-ink-muted transition hover:border-accent-600 hover:text-accent-ink disabled:opacity-60"
          >
            {TASK_STATUS_LABELS[task.status]}
          </button>
        ) : (
          <StatusBadge tone={task.status === 'done' ? 'accent' : 'neutral'}>
            {TASK_STATUS_LABELS[task.status]}
          </StatusBadge>
        )}
      </div>
    </li>
  )
}

function CommitteeColumn({
  column,
  onAddTask,
}: {
  column: BoardColumn
  onAddTask: () => void
}) {
  return (
    <section className="flex w-[286px] shrink-0 flex-col rounded-card border border-border-subtle bg-surface">
      <header className="border-b border-border-divider px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{column.name}</h2>
          {column.isMine && <StatusBadge tone="accent">Yours</StatusBadge>}
        </div>
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-subtle">
          <span className="font-mono">{column.tasks.length} tasks</span>
          {column.openRequestCount > 0 && (
            <span className="flex items-center gap-1 text-status-warning">
              <Send aria-hidden="true" className="h-3 w-3" />
              {column.openRequestCount} asked of them
            </span>
          )}
        </p>
      </header>

      {column.tasks.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-subtle">
          Nothing on the board.
        </p>
      ) : (
        <ul className="flex-1">
          {column.tasks.map((task) => (
            <TaskRow key={task.id} task={task} canEdit={column.canAddTask} />
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

/**
 * Every committee and what it is working on, side by side.
 *
 * A leadership surface: the whole point is seeing all the columns at once, so
 * it scrolls horizontally rather than collapsing into one list. Writing stays
 * scoped — `canAddTask` comes from the server, per column.
 */
export function L2BoardPage() {
  const me = useCurrentUser()
  const [addingTo, setAddingTo] = useState<BoardColumn | null>(null)

  const board = useQuery({ queryKey: ['board'], queryFn: fetchBoard })
  const picker = useQuery({
    queryKey: ['board', 'committees'],
    queryFn: fetchBoardCommittees,
    staleTime: 300_000,
  })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const header = (
    <header className="sticky top-0 z-10 border-b border-border-divider bg-surface px-4 pt-6 pb-5 sm:px-6 lg:px-10">
      <p className="mb-1.5 text-[13px] text-ink-subtle">Leadership</p>
      <h1 className="text-display font-bold text-ink">L2 Board</h1>
    </header>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      <p className="mb-5 max-w-[70ch] text-sm text-ink-subtle">
        What every committee is working on, and who has it. Adding a task here
        also lets you say which other committees you need — each one gets a{' '}
        <Link to="/requests" className="text-accent-600 underline-offset-2 hover:underline">
          request
        </Link>{' '}
        on the record.
      </p>

      {board.isPending && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Setting up the board…
        </p>
      )}

      {board.isError && (
        <ErrorState
          title="Could not load the board"
          description="The committees did not come back. Try again in a moment."
          onRetry={() => void board.refetch()}
        />
      )}

      {board.isSuccess &&
        (board.data.committees.length === 0 ? (
          <EmptyState
            title="No committees yet"
            description="Once committees exist, their work shows up here."
          />
        ) : (
          <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            {board.data.committees.map((column) => (
              <CommitteeColumn
                key={column.id}
                column={column}
                onAddTask={() => setAddingTo(column)}
              />
            ))}
          </div>
        ))}

      {addingTo && (
        <NewTaskDialog
          committee={addingTo}
          allCommittees={picker.data?.committees ?? []}
          onClose={() => setAddingTo(null)}
        />
      )}
    </AppShell>
  )
}
