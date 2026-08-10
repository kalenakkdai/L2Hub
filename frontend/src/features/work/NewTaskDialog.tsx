import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { createTask, type BoardColumn, type PickerCommittee } from './api'
import { AssigneePicker } from './AssigneePicker'
import { FIELD } from './fieldClass'

type NewTaskDialogProps = {
  committee: BoardColumn
  /** Every committee, so the caller can say who else this task needs. */
  allCommittees: PickerCommittee[]
  onClose: () => void
}

/**
 * Lists a task and, in the same step, says which other committees it needs.
 *
 * The involvement picker is the point: Fundraising books a fundraiser, ticks
 * Publicity, and Publicity has a request waiting before anyone thinks to send
 * a message about it. Leaving it empty is allowed but confirmed once, because
 * forgetting to ask is the failure this page exists to prevent.
 */
export function NewTaskDialog({
  committee,
  allCommittees,
  onClose,
}: NewTaskDialogProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [confirmingNoHelp, setConfirmingNoHelp] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => titleRef.current?.focus(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const save = useMutation({
    mutationFn: () =>
      createTask({
        committeeId: committee.id,
        title,
        details,
        assigneeUserId,
        dueOn: dueOn || null,
        collaboratorCommitteeIds: collaborators,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board'] })
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
      onClose()
    },
  })

  const others = allCommittees.filter((c) => c.id !== committee.id)

  const toggle = (id: string) => {
    setConfirmingNoHelp(false)
    setCollaborators((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    )
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    // One nudge, not a block: an empty picker is a legitimate answer.
    if (collaborators.length === 0 && !confirmingNoHelp) {
      setConfirmingNoHelp(true)
      return
    }
    save.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`New task for ${committee.name}`}
        className="w-full max-w-lg rounded-card border border-border-subtle bg-surface p-5 shadow-overlay"
      >
        <h2 className="text-[17px] font-semibold text-ink">
          New task · {committee.name}
        </h2>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Task</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Run the winter fundraiser"
              className={FIELD}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Details</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Anything the other committees need to know."
              className={FIELD}
            />
          </label>

          <AssigneePicker
            committeeId={committee.id}
            value={assigneeUserId}
            onChange={setAssigneeUserId}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Due</span>
            <input
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              className={FIELD}
            />
            <span className="text-[12.5px] text-ink-subtle">
              Whoever has this gets a reminder three days before, the day
              before, and on the day.
            </span>
          </label>

          <fieldset className="rounded-card border border-border-subtle p-3.5">
            <legend className="px-1 text-[13px] font-medium text-ink">
              Which committees do you need?
            </legend>
            <p className="mb-2.5 text-[12.5px] text-ink-subtle">
              Each one gets a request from {committee.name}, on the record.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {others.map((other) => {
                const picked = collaborators.includes(other.id)
                return (
                  <button
                    key={other.id}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => toggle(other.id)}
                    className={
                      picked
                        ? 'rounded-control border border-accent-600 bg-accent-50 px-2.5 py-1 text-[12.5px] font-medium text-accent-ink'
                        : 'rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted hover:border-accent-600 hover:text-accent-ink'
                    }
                  >
                    {other.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {confirmingNoHelp && (
            <p
              role="status"
              className="rounded-control border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[13px] text-status-warning"
            >
              No other committees selected. If this needs a post, a video, or
              anything else, pick them above — otherwise save again to continue.
            </p>
          )}

          {save.isError && (
            <p role="alert" className="text-[13px] text-status-danger">
              {save.error instanceof Error
                ? save.error.message
                : 'The task could not be saved.'}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim()}>
              {save.isPending
                ? 'Saving…'
                : confirmingNoHelp
                  ? 'Save without help'
                  : 'Add task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
