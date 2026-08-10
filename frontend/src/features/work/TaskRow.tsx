import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '../../components/ui/StatusBadge'
import {
  TASK_STATUS_LABELS,
  updateTask,
  type BoardTask,
  type TaskStatus,
} from './api'
import { DueChip, PersonChip } from './BoardBits'

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
}

type TaskRowProps = {
  task: BoardTask
  canEdit: boolean
  /** Local YYYY-MM-DD, passed in so every row on a page agrees on "today". */
  today: string
  onReassign: (task: BoardTask) => void
}

/**
 * One task, shared by both board layouts so the two cannot drift apart.
 */
export function TaskRow({ task, canEdit, today, onReassign }: TaskRowProps) {
  const queryClient = useQueryClient()
  const advance = useMutation({
    mutationFn: () => updateTask(task.id, { status: NEXT_STATUS[task.status] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  })

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

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-subtle">
        {task.event ? (
          <span className="rounded-control bg-surface-sunken px-1.5 py-0.5 text-[11.5px] font-medium text-ink-muted">
            {task.event.name}
          </span>
        ) : null}
        {task.fromCommittee ? (
          <span className="text-[11.5px] text-ink-subtle">
            from {task.fromCommittee.name}
          </span>
        ) : null}
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
