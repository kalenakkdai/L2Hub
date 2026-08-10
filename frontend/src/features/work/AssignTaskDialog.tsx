import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { updateTask, type BoardTask } from './api'
import { AssigneePicker } from './AssigneePicker'

type AssignTaskDialogProps = {
  task: BoardTask
  committeeName: string
  onClose: () => void
}

/**
 * Move a task to someone else.
 *
 * A dialog rather than an inline select on the row: the expanded board's
 * columns are 286px wide inside a horizontal scroller, which clips a native
 * popup, and an inline control would mean one roster request per task the
 * moment the board renders.
 */
export function AssignTaskDialog({ task, committeeName, onClose }: AssignTaskDialogProps) {
  const queryClient = useQueryClient()
  const titleId = useId()
  const [picked, setPicked] = useState<string | null>(task.assignee?.id ?? null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => closeRef.current?.focus(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const save = useMutation({
    // Picking the empty option and saving is how a task is unassigned; a
    // second destructive-looking button for a reversible change is noise.
    mutationFn: () =>
      updateTask(task.id, picked ? { assigneeUserId: picked } : { clearAssignee: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board'] })
      onClose()
    },
  })

  const unchanged = picked === (task.assignee?.id ?? null)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-card border border-border-subtle bg-surface p-5 shadow-overlay"
      >
        <h2 id={titleId} className="text-[17px] font-semibold text-ink">
          Who has this?
        </h2>
        <p className="mt-1 text-[13px] text-ink-subtle">
          {task.title} · {committeeName}
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
          className="mt-4 flex flex-col gap-3.5"
        >
          <AssigneePicker
            label="Assigned to"
            committeeId={task.committeeId}
            value={picked}
            onChange={setPicked}
            currentAssignee={task.assignee}
          />

          {save.isError && (
            <p role="alert" className="text-[13px] text-status-danger">
              {save.error instanceof Error
                ? save.error.message
                : 'That change could not be saved.'}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button ref={closeRef} type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || unchanged}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
