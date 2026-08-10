import type { AgendaBullet, Contributor } from '../types'

const FALLBACK: Omit<Contributor, 'name' | 'lineCount'> = {
  color: '#475569',
  highlight: '#f1f5f9',
  initials: '—',
}

export function contributorIndex(
  contributors: Contributor[],
): Map<string, Contributor> {
  return new Map(contributors.map((c) => [c.name, c]))
}

/** Name chip in the contributor's color, like a Google Docs editor tag. */
export function ContributorLegend({
  contributors,
}: {
  contributors: Contributor[]
}) {
  if (contributors.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {contributors.map((person) => (
        <span
          key={person.name}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: person.highlight,
            color: person.color,
            boxShadow: `inset 0 0 0 1px ${person.color}33`,
          }}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-semibold text-white"
            style={{ backgroundColor: person.color }}
          >
            {person.initials}
          </span>
          {person.name}
          <span className="text-ink-subtle">· {person.lineCount}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * One agenda line highlighted in the color of whoever contributed it. Lines
 * with no attributed speaker render plainly so the doc stays readable.
 */
export function AttributedLine({
  bullet,
  contributors,
  showName = true,
  as: Tag = 'li',
}: {
  bullet: AgendaBullet
  contributors: Map<string, Contributor>
  showName?: boolean
  as?: 'li' | 'p'
}) {
  const person = bullet.speaker ? contributors.get(bullet.speaker) : undefined
  const style = person
    ? {
        backgroundColor: person.highlight,
        borderLeftColor: person.color,
      }
    : { borderLeftColor: 'transparent' }

  return (
    <Tag
      className="rounded-r-control border-l-2 px-2 py-1 text-sm text-ink"
      style={style}
    >
      {showName && bullet.speaker ? (
        <span
          className="mr-1.5 text-xs font-semibold"
          style={{ color: person?.color ?? FALLBACK.color }}
        >
          {bullet.speaker}:
        </span>
      ) : null}
      {bullet.text}
    </Tag>
  )
}

/** Google-Docs-style attributed transcript of the captured window. */
export function AttributedTranscript({
  lines,
  contributors,
}: {
  lines: AgendaBullet[]
  contributors: Contributor[]
}) {
  const index = contributorIndex(contributors)
  return (
    <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
      {lines.map((line, i) => (
        <AttributedLine
          key={`${line.speaker ?? 'unattributed'}-${i}`}
          bullet={line}
          contributors={index}
        />
      ))}
    </ul>
  )
}
