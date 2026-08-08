import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from './primitives'

export type DangerAction = {
  id: string
  label: string
  description: string
  buttonLabel: string
  /** When set, the camper must type this exact string to confirm. */
  confirmText?: string
  confirmTitle: string
  confirmDescription: string
  disabled?: boolean
  disabledReason?: string
  onConfirm: () => void | Promise<void>
}

type DangerZoneProps = {
  actions: DangerAction[]
  children?: ReactNode
}

/**
 * Visually separated block for anything irreversible.
 *
 * Every action here is behind a confirmation dialog, and the worst of them
 * require typing the Campsite name. The UI is the last line of defence, not
 * the only one — the destructive operations are guarded in the database too.
 */
export function DangerZone({ actions, children }: DangerZoneProps) {
  const [pending, setPending] = useState<DangerAction | null>(null)

  return (
    <section
      id="danger"
      aria-labelledby="danger-heading"
      className="scroll-mt-24 rounded-card border border-status-danger-border bg-status-danger-bg/40 p-5 sm:p-6"
    >
      <h2 id="danger-heading" className="font-semibold text-status-danger">
        Danger zone
      </h2>
      <p className="mt-1 text-[13px] text-ink-subtle">
        These cannot be undone. Each one asks for confirmation first.
      </p>

      {children}

      <ul className="mt-4 flex flex-col gap-3">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{action.label}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-subtle">{action.description}</p>
            </div>

            <button
              type="button"
              disabled={action.disabled}
              title={action.disabled ? action.disabledReason : undefined}
              onClick={() => setPending(action)}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-control border border-status-danger px-3 text-label font-medium text-status-danger transition duration-200 hover:bg-status-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-status-danger"
            >
              {action.buttonLabel}
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.confirmTitle ?? ''}
        description={pending?.confirmDescription ?? ''}
        confirmLabel={pending?.buttonLabel ?? 'Confirm'}
        confirmText={pending?.confirmText}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending
          setPending(null)
          void action?.onConfirm()
        }}
      />
    </section>
  )
}
