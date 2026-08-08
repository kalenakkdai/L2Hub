import { useEffect, useRef } from 'react'
import { CODE_LENGTH } from '../../lib/verification'
import { cn } from '../ui/cn'

type CodeInputProps = {
  value: string
  onChange: (value: string) => void
  /** Fired when all six digits are present. */
  onComplete: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}

const DIGITS_ONLY = /\D/g

/**
 * Six single-character boxes that behave like one field.
 *
 * Typing advances, backspace on an empty box steps back, and pasting a code
 * fills all six wherever the cursor happens to be. The boxes share one
 * accessible label so a screen reader announces the group, not six anonymous
 * text inputs.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
}: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus()
  }, [disabled])

  const setDigit = (index: number, digit: string) => {
    const next = value.padEnd(CODE_LENGTH, ' ').split('')
    next[index] = digit || ' '
    const joined = next.join('').replace(/ /g, '')
    onChange(joined)
    return joined
  }

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(DIGITS_ONLY, '')
    if (!digits) return

    // A paste can arrive through a single box; spread it across the rest.
    if (digits.length > 1) {
      const filled = digits.slice(0, CODE_LENGTH)
      onChange(filled)
      const focusIndex = Math.min(filled.length, CODE_LENGTH - 1)
      refs.current[focusIndex]?.focus()
      if (filled.length === CODE_LENGTH) onComplete(filled)
      return
    }

    const joined = setDigit(index, digits)
    if (index < CODE_LENGTH - 1) refs.current[index + 1]?.focus()
    if (joined.length === CODE_LENGTH) onComplete(joined)
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) {
        setDigit(index, '')
        return
      }
      // Empty box: step back and clear the one behind it.
      if (index > 0) {
        setDigit(index - 1, '')
        refs.current[index - 1]?.focus()
      }
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault()
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const digits = event.clipboardData.getData('text').replace(DIGITS_ONLY, '').slice(0, CODE_LENGTH)
    if (!digits) return

    onChange(digits)
    const focusIndex = Math.min(digits.length, CODE_LENGTH - 1)
    refs.current[focusIndex]?.focus()
    if (digits.length === CODE_LENGTH) onComplete(digits)
  }

  return (
    <div
      role="group"
      aria-label="Verification code"
      className="flex justify-between gap-2"
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={CODE_LENGTH}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid ? 'true' : undefined}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={cn(
            'h-12 w-11 rounded-card border bg-surface text-center font-mono text-lg text-ink outline-none transition duration-200',
            'focus:border-accent-600 focus:ring-[3px] focus:ring-accent-600/13',
            'disabled:bg-surface-muted disabled:text-ink-subtle',
            invalid ? 'border-status-danger' : 'border-border-subtle',
          )}
        />
      ))}
    </div>
  )
}
