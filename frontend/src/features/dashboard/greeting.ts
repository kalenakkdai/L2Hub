/**
 * Rotating greetings — the one bit of whimsy on the dashboard.
 *
 * Each greeting is a short phrase, the name, and the punctuation that phrase
 * actually calls for: "Afternoon, Brittany." but "Still up, Brittany?".
 * Nothing follows it, because the header already carries the numbers a
 * further sentence would have restated.
 *
 * The mark travels with the phrase rather than being appended by the
 * formatter. Every greeting used to end in a full stop, which turned the
 * questions among them into flat statements — "Still up, Brittany." reads as
 * an observation about the camper rather than a note of solidarity.
 *
 * A phrase is chosen once per session per time-of-day block and then held, so
 * the page does not reword itself on every re-render. The choice lives in
 * sessionStorage so it also survives a refresh.
 */

type Block = 'morning' | 'afternoon' | 'evening' | 'late'

/** A phrase and the mark that ends it — '?' where the phrase asks something. */
type Greeting = { phrase: string; mark: '.' | '?' }

const GREETINGS: Record<Block, Greeting[]> = {
  morning: [
    { phrase: 'Morning', mark: '.' },
    { phrase: 'Good morning', mark: '.' },
    { phrase: 'Bright and early', mark: '.' },
    { phrase: 'Early start', mark: '.' },
  ],
  afternoon: [
    { phrase: 'Afternoon', mark: '.' },
    { phrase: 'Good afternoon', mark: '.' },
    { phrase: 'Almost caught up', mark: '?' },
    { phrase: 'Midday', mark: '.' },
  ],
  evening: [
    { phrase: 'Evening', mark: '.' },
    { phrase: 'Good evening', mark: '.' },
    { phrase: 'Winding down', mark: '?' },
    { phrase: 'Nice work today', mark: '.' },
  ],
  late: [
    { phrase: 'Working late', mark: '?' },
    { phrase: 'Still up', mark: '?' },
    { phrase: 'Late one', mark: '.' },
    { phrase: 'Past midnight', mark: '.' },
  ],
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
  const { phrase, mark } = options[stableIndex(block, options.length)]

  // The name goes inside the sentence, so the mark stays at the end whether
  // or not there is one: "Still up, Brittany?" and "Still up?".
  return firstName ? `${phrase}, ${firstName}${mark}` : `${phrase}${mark}`
}
