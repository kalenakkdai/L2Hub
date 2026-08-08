import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { FIELD_CLASS } from './primitives'
import { fetchUsers } from '../../api/users'
import { transferAdmin } from '../../api/campsite'

type TransferAdminDialogProps = {
  open: boolean
  onClose: () => void
  onTransferred: (recipientName: string) => void
  /** Excluded from the list — you cannot transfer to yourself. */
  currentUserId: string
}

/**
 * Picks the incoming administrator.
 *
 * The server assigns the recipient before removing the caller, so there is no
 * moment where the Campsite has no administrator. This dialog only chooses
 * who; it enforces nothing.
 */
export function TransferAdminDialog({
  open,
  onClose,
  onTransferred,
  currentUserId,
}: TransferAdminDialogProps) {
  const [recipient, setRecipient] = useState('')
  const [keepOwnRole, setKeepOwnRole] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const users = useQuery({
    queryKey: ['users', 'transfer-candidates'],
    queryFn: () => fetchUsers(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setRecipient('')
      setKeepOwnRole(false)
      setError(null)
      return
    }
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const candidates = (users.data?.users ?? []).filter(
    (user) => user.id !== currentUserId && user.status === 'active',
  )

  const submit = async () => {
    if (!recipient) return
    setSubmitting(true)
    setError(null)

    try {
      const result = await transferAdmin(recipient, keepOwnRole)
      onTransferred(result.recipientName)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not transfer administration.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-navy-950/50" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
        className="relative w-full max-w-md rounded-card border border-border-subtle bg-surface p-6 shadow-overlay"
      >
        <h2 id="transfer-title" className="text-title font-semibold text-ink">
          Transfer administration
        </h2>
        <p className="mt-2 text-sm text-ink-subtle">
          The camper you pick becomes an AC immediately. Unless you keep your own role,
          yours is removed in the same step.
        </p>

        <div className="mt-4">
          <label htmlFor="transfer-to" className="mb-1.5 block text-[13px] font-medium text-ink">
            Transfer to
          </label>
          <select
            id="transfer-to"
            value={recipient}
            disabled={users.isPending}
            onChange={(event) => setRecipient(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">
              {users.isPending ? 'Loading campers…' : 'Choose a camper'}
            </option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.email}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={keepOwnRole}
            onChange={(event) => setKeepOwnRole(event.target.checked)}
          />
          Keep my own administrator role
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-status-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button ref={closeRef} variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!recipient || submitting} onClick={() => void submit()}>
            {submitting ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
