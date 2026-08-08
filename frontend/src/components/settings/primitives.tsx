import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import type { SaveStatus } from '../../hooks/useProfile'

/** Small acknowledgement beside a section heading. Never a global save button. */
export function SavedIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  if (status === 'saving') {
    return (
      <span role="status" className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
        <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
        Saving
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span role="status" className="flex items-center gap-1.5 text-[12.5px] text-accent-600">
        <Check aria-hidden="true" className="h-3 w-3" />
        Saved
      </span>
    )
  }

  return (
    <span role="alert" className="flex items-center gap-1.5 text-[12.5px] text-status-danger">
      <TriangleAlert aria-hidden="true" className="h-3 w-3" />
      Not saved
    </span>
  )
}

/** A titled block of settings. Plain by design — no motion, no ornament. */
export function SettingsCard({
  title,
  description,
  status,
  children,
  id,
}: {
  title: string
  description?: string
  status?: SaveStatus
  children: ReactNode
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-24 rounded-card border border-border-subtle bg-surface p-5 sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id={headingId} className="font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-[13px] text-ink-subtle">{description}</p>}
        </div>
        {status !== undefined && <SavedIndicator status={status} />}
      </div>
      {children}
    </section>
  )
}

export const FIELD_CLASS =
  'h-10 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition duration-200 focus:border-accent-600 focus:ring-[3px] focus:ring-accent-600/13 disabled:bg-surface-muted disabled:text-ink-subtle'

/** Label, control, and optional hint in the layout every field uses. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] text-ink-subtle">{hint}</p>}
    </div>
  )
}

/**
 * Switch-style toggle.
 *
 * A real button with aria-pressed rather than a styled checkbox, so the
 * disabled reason can be announced through aria-describedby.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  disabledReason,
  size = 'md',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  disabledReason?: string
  size?: 'sm' | 'md'
}) {
  const hintId = disabled && disabledReason ? `${label.replace(/\W+/g, '-')}-hint` : undefined

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={hintId}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200',
          size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
          checked
            ? 'border-accent-600 bg-accent-600'
            : 'border-border-strong bg-surface-muted',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block rounded-full bg-white shadow-xs transition-transform duration-200',
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5',
            checked
              ? size === 'sm'
                ? 'translate-x-4'
                : 'translate-x-5.5'
              : 'translate-x-0.5',
          )}
        />
      </button>
      {hintId && (
        <span id={hintId} className="sr-only">
          {disabledReason}
        </span>
      )}
    </>
  )
}

/** Verified / Unverified chip beside a contact method. */
export function VerificationChip({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-xs font-medium',
        verified
          ? 'border-accent-200 bg-accent-100 text-accent-600'
          : 'border-status-warning-border bg-status-warning-bg text-status-warning',
      )}
    >
      {verified && <Check aria-hidden="true" className="h-3 w-3" />}
      {verified ? 'Verified' : 'Unverified'}
    </span>
  )
}

/**
 * Confirmation dialog for anything destructive.
 *
 * When `confirmText` is given, the action stays disabled until it is typed
 * exactly — used for Break Camp and delete, where a misclick is unrecoverable.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmText,
  onConfirm,
  onCancel,
  destructive = true,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}) {
  const [typed, setTyped] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    cancelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const ready = confirmText === undefined || typed === confirmText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 bg-navy-950/50" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="relative w-full max-w-md rounded-card border border-border-subtle bg-surface p-6 shadow-overlay"
      >
        <h2 id="confirm-title" className="text-title font-semibold text-ink">
          {title}
        </h2>
        <p id="confirm-description" className="mt-2 text-sm text-ink-subtle">
          {description}
        </p>

        {confirmText !== undefined && (
          <div className="mt-4">
            <label htmlFor="confirm-input" className="mb-1.5 block text-[13px] text-ink">
              Type <span className="font-mono font-medium text-ink">{confirmText}</span> to
              confirm
            </label>
            <input
              id="confirm-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className={FIELD_CLASS}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!ready}
            onClick={onConfirm}
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-control px-3 text-label font-medium transition duration-200 disabled:pointer-events-none disabled:opacity-50',
              destructive
                ? 'bg-status-danger text-white hover:opacity-90'
                : 'bg-accent-600 text-white hover:bg-accent-700',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
