/**
 * Rotating greetings — the one bit of whimsy on the dashboard.
 *
 * Each greeting is a short phrase, the name, and a full stop: "Afternoon,
 * Brittany.", "Almost caught up, Brittany." Nothing follows it, because the
 * header already carries the numbers a further sentence would have restated.
 *
 * A phrase is chosen once per session per time-of-day block and then held, so
 * the page does not reword itself on every re-render. The choice lives in
 * sessionStorage so it also survives a refresh.
 */

type Block = 'morning' | 'afternoon' | 'evening' | 'late'

const GREETINGS: Record<Block, string[]> = {
  morning: ['Morning', 'Good morning', 'Bright and early', 'Early start'],
  afternoon: ['Afternoon', 'Good afternoon', 'Almost caught up', 'Midday'],
  evening: ['Evening', 'Good evening', 'Winding down', 'Nice work today'],
  late: ['Working late', 'Still up', 'Late one', 'Past midnight'],
}

export function blockFor(hour: number): Block {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late'
}

/** Picks a stable index for this session, falling back to the first phrase. */
function stableIndex(block: Block, length: number): number {
  const key = `quad.greeting.${block}`

  try {
    const stored = sessionStorage.getItem(key)
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10)
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < length) return parsed
    }
    const next = Math.floor(Math.random() * length)
    sessionStorage.setItem(key, String(next))
    return next
  } catch {
    // Private browsing or a blocked storage partition — a fixed greeting is
    // a fine outcome, an exception is not.
    return 0
  }
}

/**
 * Greets by first name.
 *
 * Pass null when the camper has not told us their name. The phrase then
 * stands on its own rather than falling back to an email address, which is
 * an identifier and not a way to address a person.
 */
export function greetingFor(firstName: string | null, now: Date = new Date()): string {
  const block = blockFor(now.getHours())
  const options = GREETINGS[block]
  const phrase = options[stableIndex(block, options.length)]

  return firstName ? `${phrase}, ${firstName}.` : `${phrase}.`
}
