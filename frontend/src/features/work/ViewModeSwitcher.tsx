import { BOARD_VIEW_LABELS, type BoardViewMode } from './boardView'

const MODES: BoardViewMode[] = ['expanded', 'compact']

type ViewModeSwitcherProps = {
  value: BoardViewMode
  onChange: (next: BoardViewMode) => void
}

/**
 * Switch between the side-by-side columns and the collapsible rows.
 *
 * A group of pressed buttons rather than a tablist: there is no tab and no
 * panel here, the whole content region is laid out differently. The pill
 * styling is the one already used by the filters on the requests log, so the
 * two pages in this feature look like one.
 */
export function ViewModeSwitcher({ value, onChange }: ViewModeSwitcherProps) {
  return (
    <div role="group" aria-label="Board layout" className="flex flex-wrap gap-1.5">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={
            value === mode
              ? 'rounded-control border border-accent-600 bg-accent-50 px-2.5 py-1 text-[12.5px] font-medium text-accent-ink'
              : 'rounded-control border border-border-subtle px-2.5 py-1 text-[12.5px] text-ink-muted transition hover:border-accent-600 hover:text-accent-ink'
          }
        >
          {BOARD_VIEW_LABELS[mode]}
        </button>
      ))}
    </div>
  )
}
