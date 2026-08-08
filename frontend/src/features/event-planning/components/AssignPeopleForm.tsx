import { useState } from 'react'
import {
  usePlanningCommands,
  usePlanningDirectory,
} from '../hooks/useEventPlanning'
import type { AssignmentTargetType } from '../types'

export function AssignPeopleForm({ planId }: { planId: string }) {
  const { members, committees } = usePlanningDirectory()
  const { assign } = usePlanningCommands(planId)
  const [targetType, setTargetType] = useState<AssignmentTargetType>('committee')
  const [committeeId, setCommitteeId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [roleLabel, setRoleLabel] = useState('')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void assign.mutateAsync({
          id: planId,
          input: {
            targetType,
            committeeId: targetType === 'committee' ? committeeId : null,
            memberId: targetType === 'individual' ? memberId : null,
            roleLabel,
          },
        })
        setRoleLabel('')
      }}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-control px-2.5 py-1.5 text-xs font-medium ${
            targetType === 'committee'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-sunken text-ink-muted'
          }`}
          onClick={() => setTargetType('committee')}
        >
          By committee
        </button>
        <button
          type="button"
          className={`rounded-control px-2.5 py-1.5 text-xs font-medium ${
            targetType === 'individual'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-sunken text-ink-muted'
          }`}
          onClick={() => setTargetType('individual')}
        >
          By individual
        </button>
      </div>

      {targetType === 'committee' ? (
        <div>
          <label
            htmlFor="assign-committee"
            className="text-xs font-medium text-ink-muted"
          >
            Committee
          </label>
          <select
            id="assign-committee"
            required
            value={committeeId}
            onChange={(event) => setCommitteeId(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">Select committee…</option>
            {(committees.data ?? []).map((committee: { id: string; name: string }) => (
              <option key={committee.id} value={committee.id}>
                {committee.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label
            htmlFor="assign-member"
            className="text-xs font-medium text-ink-muted"
          >
            Individual
          </label>
          <select
            id="assign-member"
            required
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">Select member…</option>
            {(members.data ?? []).map((member: { id: string; name: string }) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="assign-role"
          className="text-xs font-medium text-ink-muted"
        >
          Role on this plan
        </label>
        <input
          id="assign-role"
          required
          value={roleLabel}
          onChange={(event) => setRoleLabel(event.target.value)}
          className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          placeholder="e.g. Station leads, Check-in captain"
        />
      </div>

      {assign.isError ? (
        <p className="text-sm text-status-danger" role="alert">
          {assign.error instanceof Error
            ? assign.error.message
            : 'Could not assign'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={assign.isPending}
        className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
      >
        Add assignment
      </button>
    </form>
  )
}
