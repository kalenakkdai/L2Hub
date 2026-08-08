import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import {
  useClassOfficersCommands,
  useClassOfficersSnapshot,
} from '../hooks/useClassOfficers'
import { centsToDollars, fundraiserPercent } from '../lib/progress'

type OutletContext = { canManage: boolean }

export function FundraiserPage() {
  const { canManage } = useOutletContext<OutletContext>()
  const snapshot = useClassOfficersSnapshot()
  const { updateFundraiser } = useClassOfficersCommands()
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [targetDollars, setTargetDollars] = useState('')
  const [raisedDollars, setRaisedDollars] = useState('')

  useEffect(() => {
    if (!snapshot.data) return
    const goal = snapshot.data.fundraiser
    setLabel(goal.label)
    setNotes(goal.notes)
    setTargetDollars(String(goal.targetCents / 100))
    setRaisedDollars(String(goal.raisedCents / 100))
  }, [snapshot.data])

  if (snapshot.isPending) {
    return <p className="text-sm text-ink-muted">Loading fundraiser…</p>
  }
  if (snapshot.isError || !snapshot.data) {
    return (
      <ErrorState
        title="Could not load fundraiser"
        description="Try again in a moment."
        onRetry={() => void snapshot.refetch()}
      />
    )
  }

  const goal = snapshot.data.fundraiser
  const percent = fundraiserPercent(goal)

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-ink">{goal.label}</h2>
        <p className="mt-3 text-3xl font-semibold text-ink">
          {centsToDollars(goal.raisedCents)}
          <span className="text-lg font-normal text-ink-muted">
            {' '}
            / {centsToDollars(goal.targetCents)}
          </span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{percent}% of goal</p>
        <div className="mt-4">
          <ProgressBar
            value={goal.raisedCents}
            max={goal.targetCents}
            label="Fundraiser goal progress"
            className="h-3"
          />
        </div>

        <ol className="mt-5 flex flex-wrap gap-2">
          {goal.milestones.map((milestone) => {
            const reached = goal.raisedCents >= milestone * 100
            return (
              <li
                key={milestone}
                className={`rounded-control px-2.5 py-1 text-xs font-semibold ${
                  reached
                    ? 'bg-accent-50 text-accent-700'
                    : 'bg-surface-sunken text-ink-subtle'
                }`}
              >
                ${milestone / 1000}k
              </li>
            )
          })}
        </ol>

        {goal.notes ? (
          <p className="mt-4 text-sm text-ink-muted">{goal.notes}</p>
        ) : null}
      </section>

      {canManage ? (
        <form
          className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void updateFundraiser.mutateAsync({
              label,
              notes,
              targetCents: Math.round(Number(targetDollars) * 100),
              raisedCents: Math.round(Number(raisedDollars) * 100),
            })
          }}
        >
          <h3 className="text-sm font-semibold text-ink">Update goal</h3>
          <label className="block text-xs font-medium text-ink-muted">
            Label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block text-xs font-medium text-ink-muted">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-ink-muted">
              Target ($)
              <input
                type="number"
                min={1}
                step={1}
                value={targetDollars}
                onChange={(event) => setTargetDollars(event.target.value)}
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Raised ($)
              <input
                type="number"
                min={0}
                step={1}
                value={raisedDollars}
                onChange={(event) => setRaisedDollars(event.target.value)}
                className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={updateFundraiser.isPending}
            className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Save fundraiser
          </button>
          {updateFundraiser.isError ? (
            <p className="text-xs text-status-danger">Could not save. Check the amounts.</p>
          ) : null}
        </form>
      ) : (
        <p className="text-xs text-ink-subtle">
          Class Advisors can watch this bar but cannot edit it.
        </p>
      )}
    </div>
  )
}
