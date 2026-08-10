/**
 * "Ada Lovelace" → "AL".
 *
 * Falls back to "?" so an avatar well is never rendered blank, and takes at
 * most two parts so a long name does not overflow a 30px square.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}
