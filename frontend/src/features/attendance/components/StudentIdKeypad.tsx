import { Delete } from 'lucide-react'

type StudentIdKeypadProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete']

/** Large touch targets for iPhone/iPad fallback check-in. */
export function StudentIdKeypad({
  value,
  disabled = false,
  onChange,
  onSubmit,
}: StudentIdKeypadProps) {
  const press = (key: string) => {
    if (key === 'clear') onChange('')
    else if (key === 'delete') onChange(value.slice(0, -1))
    else if (value.length < 32) onChange(`${value}${key}`)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-ink-muted">
        Student ID
        <input
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, '').slice(0, 32))
          }
          disabled={disabled}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-3 text-center font-mono text-2xl tracking-[0.2em] text-ink"
          placeholder="••••••"
        />
      </label>

      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden" aria-label="Student ID keypad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            aria-label={key === 'delete' ? 'Delete digit' : key}
            className="flex min-h-14 items-center justify-center rounded-control border border-border-strong bg-surface text-lg font-semibold text-ink shadow-xs active:bg-surface-sunken disabled:opacity-50"
          >
            {key === 'delete' ? (
              <Delete size={20} aria-hidden="true" />
            ) : key === 'clear' ? (
              <span className="text-xs uppercase">Clear</span>
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || value.length < 4}
        onClick={onSubmit}
        className="mt-3 w-full rounded-control bg-accent-600 px-4 py-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
      >
        Check in
      </button>
    </div>
  )
}
