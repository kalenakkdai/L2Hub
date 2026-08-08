import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../lib/appearance'

/**
 * Counts from 0 up to `target` over `duration`, eased out.
 *
 * Returns the target immediately when the user has asked for reduced motion,
 * or when requestAnimationFrame is unavailable — the number is information,
 * and it must never be wrong or missing just because animation is off.
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? target : 0,
  )
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setValue(target)
      return
    }

    const start = performance.now()
    const from = 0

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [target, duration])

  return value
}
