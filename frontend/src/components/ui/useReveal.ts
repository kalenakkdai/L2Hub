import { useEffect, useRef } from 'react'

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Returns a ref to spread onto any element carrying `data-reveal`. The
 * element is revealed once and then unobserved — content that has already
 * been read should not re-animate when the user scrolls back.
 *
 * Falls back to showing immediately where IntersectionObserver is missing
 * (jsdom, for one), and has a safety timer so nothing can stay invisible.
 */
export function useReveal<T extends HTMLElement>(delayIndex = 0) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const show = () => node.setAttribute('data-shown', 'true')

    if (typeof IntersectionObserver === 'undefined') {
      show()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          window.setTimeout(show, delayIndex * 70)
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )

    observer.observe(node)
    // Nothing stays hidden, whatever the observer decides.
    const failsafe = window.setTimeout(show, 1400)

    return () => {
      observer.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [delayIndex])

  return ref
}
