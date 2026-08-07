/**
 * Rotating greetings — the one bit of whimsy on the dashboard.
 *
 * A greeting is chosen once per session per time-of-day block and then held,
 * so the page does not reword itself on every re-render. The choice is stored
 * in sessionStorage rather than state so it also survives a refresh.
 */

type Block = 'morning' | 'afternoon' | 'evening' | 'late'

const GREETINGS: Record<Block, string[]> = {
  morning: [
    'Good morning, {name}',
    'Morning, {name}. Your committee is already up.',
    'Morning, {name}. Three things need you.',
    'Good morning, {name}. Quad setup at 7.',
  ],
  afternoon: [
    'Good afternoon, {name}',
    'Afternoon, {name}. Two items still open.',
    'Afternoon, {name}. Almost caught up.',
    'Hi {name}. The Quad is busy today.',
  ],
  evening: [
    'Good evening, {name}',
    'Evening, {name}. One thing left today.',
    'Evening, {name}. The Campsite is quiet.',
    'Evening, {name}. Nice work today.',
  ],
  late: [
    'Working late, {name}',
    'Still up, {name}?',
    'Working late, {name}. Prep can wait.',
    'Late one, {name}. This can keep until tomorrow.',
  ],
}

export function blockFor(hour: number): Block {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late'
}

/** Picks a stable index for this session, falling back to the first line. */
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

export function greetingFor(name: string, now: Date = new Date()): string {
  const block = blockFor(now.getHours())
  const options = GREETINGS[block]
  return options[stableIndex(block, options.length)].replace('{name}', name)
}
