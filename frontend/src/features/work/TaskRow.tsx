import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '../../components/ui/StatusBadge'
import {
  TASK_STATUS_LABELS,
  updateTask,
  type BoardTask,
  type TaskStatus,
} from './api'
import { DueChip, PersonChip } from './BoardBits'

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done']

type TaskRowProps = {
  task: BoardTask
  /** May reassign and move the task — the committee's manage key. */
  canEdit: boolean
  /** Local YYYY-MM-DD, passed in so every row on a page agrees on "today". */
  today: string
  onReassign: (task: BoardTask) => void
  /** The signed-in camper. Whoever has a task may move it, without reassigning. */
  viewerId?: string
  /** Names the committee under the title, for lists that mix committees. */
  committeeName?: string
}

/**
 * One task, shared by the board layouts and My tasks so they cannot drift apart.
 */
export function TaskRow({
  task,
  canEdit,
  today,
  onReassign,
  viewerId,
  committeeName,
}: TaskRowProps) {
  const queryClient = useQueryClient()
  const move = useMutation({
    mutationFn: (status: TaskStatus) => updateTask(task.id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  })

  const canSetStatus =
    canEdit || (viewerId !== undefined && task.assignee?.id === viewerId)

  const name = task.assignee?.name ?? null

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
      {committeeName && (
        <p className="mt-0.5 text-[12px] text-ink-subtle">{committeeName}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-subtle">
        {canEdit ? (
          // The assignee is the trigger, so changing who has a task is one
          // click on the thing you want to change rather than a hunt for a
          // menu. The name stays in its own span so it still reads as text.
          <button
            type="button"
            onClick={() => onReassign(task)}
            aria-label={`${task.title} — ${
              name ? `assigned to ${name}` : 'unassigned'
            }. Change who has it`}
            className="-mx-1 inline-flex items-center gap-1.5 rounded-[5px] px-1 transition hover:text-accent-ink"
          >
            <PersonChip name={name} />
            <span>{name ?? 'Unassigned'}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <PersonChip name={name} />
            <span>{name ?? 'Unassigned'}</span>
          </span>
        )}
        <DueChip task={task} today={today} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        {canSetStatus ? (
          // A menu rather than a click-to-cycle button: cycling meant one
          // click too many sent a finished task back to "To do".
          <select
            value={task.status}
            onChange={(event) => move.mutate(event.target.value as TaskStatus)}
            disabled={move.isPending}
            aria-label={`Status of ${task.title}`}
            className="rounded-[5px] border border-border-subtle bg-surface px-1.5 py-0.5 text-xs font-medium text-ink-muted transition hover:border-accent-600 focus:border-accent-600 focus:outline-none disabled:opacity-60"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge tone={task.status === 'done' ? 'accent' : 'neutral'}>
            {TASK_STATUS_LABELS[task.status]}
          </StatusBadge>
        )}
        {move.isError && (
          <span role="alert" className="text-xs text-status-danger">
            Could not update it.
          </span>
        )}
      </div>
    </li>
  )
}
