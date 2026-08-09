import { Link } from 'react-router-dom'

const LOG_MIME = 'application/x-l2hub-meeting-log'

export { LOG_MIME }

/** Truncate a meeting title for the label carved under a fire. */
export function truncateLogName(value: string, max = 22): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

type MeetingLogVisualProps = {
  title: string
  /** Larger decorative log for the yard; compact for under-fire stacks. */
  size?: 'yard' | 'underfire'
  className?: string
}

/** Crossed wood log graphic with the meeting name. */
export function MeetingLogVisual({
  title,
  size = 'yard',
  className,
}: MeetingLogVisualProps) {
  const compact = size === 'underfire'
  const width = compact ? 72 : 140
  const height = compact ? 28 : 40

  return (
    <span
      className={['inline-flex flex-col items-center gap-0.5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        viewBox="0 0 140 40"
        width={width}
        height={height}
        aria-hidden="true"
        className="overflow-visible"
      >
        <g strokeLinecap="round">
          <line
            x1={18}
            y1={28}
            x2={122}
            y2={14}
            stroke="#5c3d28"
            strokeWidth={compact ? 8 : 11}
          />
          <line
            x1={18}
            y1={28}
            x2={122}
            y2={14}
            stroke="#8b5a3c"
            strokeWidth={compact ? 4 : 5}
            opacity={0.85}
          />
          <line
            x1={22}
            y1={12}
            x2={118}
            y2={30}
            stroke="#4a3222"
            strokeWidth={compact ? 7 : 10}
          />
          <line
            x1={22}
            y1={12}
            x2={118}
            y2={30}
            stroke="#6b4423"
            strokeWidth={compact ? 3.5 : 4.5}
            opacity={0.9}
          />
        </g>
      </svg>
      <span
        className={
          compact
            ? 'max-w-[5.5rem] truncate text-center text-[10px] font-medium leading-tight text-navy-ink'
            : 'max-w-[9rem] truncate text-center text-xs font-semibold text-ink'
        }
        title={title}
      >
        {truncateLogName(title, compact ? 18 : 28)}
      </span>
    </span>
  )
}

type NamedLogsUnderFireProps = {
  logs: Array<{ id: string; title: string }>
}

/** Physical named logs stacked under an event fire pit. */
export function NamedLogsUnderFire({ logs }: NamedLogsUnderFireProps) {
  if (logs.length === 0) {
    return (
      <p className="mt-1 text-center text-[10px] text-navy-ink-muted">No logs yet</p>
    )
  }

  return (
    <ul className="mt-1 flex max-w-[11rem] flex-col items-center gap-1">
      {logs.map((log) => (
        <li key={log.id}>
          <Link
            to={`/note-taker/${log.id}`}
            className="block rounded-control px-1 py-0.5 hover:bg-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <MeetingLogVisual title={log.title} size="underfire" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
