import { useId } from 'react'
import type { Person } from './api'
import { FIELD } from './fieldClass'
import { useCommitteeMembers } from './useCommitteeMembers'

type AssigneePickerProps = {
  committeeId: string
  /** Selected user id, or null for unassigned. */
  value: string | null
  onChange: (userId: string | null) => void
  label?: string
  /**
   * The person who currently holds the task. Kept in the list even when they
   * are no longer on the roster — see the note in the body.
   */
  currentAssignee?: Person | null
  disabled?: boolean
}

/**
 * Choose who has a task.
 *
 * A native select rather than a custom listbox: nothing in this app has one,
 * and building it would mean keyboard handling, typeahead and a portal, all
 * to lose the platform's own mobile picker.
 *
 * A refused roster (403, for a camper who cannot manage this committee) and a
 * missing endpoint (404) render identically — a disabled control and a quiet
 * hint. There is no error state shouting at someone who was only looking.
 */
export function AssigneePicker({
  committeeId,
  value,
  onChange,
  label = 'Assignee',
  currentAssignee = null,
  disabled = false,
}: AssigneePickerProps) {
  const id = useId()
  const roster = useCommitteeMembers(committeeId)

  const members = roster.data?.members ?? []

  // The roster may not contain the current assignee — they can leave the
  // committee while still holding a task. Without them in the options the
  // select would find no match for `value`, silently fall back to the empty
  // option, and quietly unassign the task on save.
  const options = [...members]
  if (currentAssignee && !options.some((m) => m.id === currentAssignee.id)) {
    options.push({
      id: currentAssignee.id,
      name: currentAssignee.name,
      position: 'No longer in this committee',
      isHead: false,
      avatarUrl: null,
    })
  }

  const unavailable = roster.isError
  const placeholder = roster.isPending ? 'Loading committee…' : 'Unassigned'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled || roster.isPending || unavailable}
        onChange={(event) => onChange(event.target.value || null)}
        className={FIELD}
      >
        <option value="">{placeholder}</option>
        {options.map((member) => (
          <option key={member.id} value={member.id}>
            {member.position ? `${member.name} · ${member.position}` : member.name}
          </option>
        ))}
      </select>
      {unavailable && (
        <p className="text-[12.5px] text-ink-subtle">
          Only committee heads can change who has this.
        </p>
      )}
    </div>
  )
}
