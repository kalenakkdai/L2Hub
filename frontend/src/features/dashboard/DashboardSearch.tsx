import { Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampsiteChrome } from '../../hooks/useCampsiteModules'
import { searchSiteDestinations, type SiteSearchHit } from './lib/siteSearch'

type DashboardSearchProps = {
  permissions?: string[]
}

/**
 * Dashboard jump bar: type a page name (or alias like "gradebook") and go.
 *
 * Results reuse sidebar permission/module filtering so campers never jump to
 * destinations they cannot open from the nav.
 */
export function DashboardSearch({ permissions }: DashboardSearchProps) {
  const navigate = useNavigate()
  const chrome = useCampsiteChrome()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const hits = searchSiteDestinations(
    query,
    permissions,
    chrome.data?.modulesEnabled,
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query, hits.length])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function goTo(hit: SiteSearchHit) {
    if (!hit.implemented) return
    setQuery('')
    setOpen(false)
    navigate(hit.to)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const hit = hits[activeIndex] ?? hits[0]
    if (hit) goTo(hit)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || hits.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % hits.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length)
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <form role="search" onSubmit={onSubmit}>
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search pages
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          />
          <input
            ref={inputRef}
            id={`${listId}-input`}
            type="search"
            value={query}
            autoComplete="off"
            placeholder="Search pages — grades, events, notes…"
            aria-expanded={open}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={
              open && hits[activeIndex]
                ? `${listId}-option-${activeIndex}`
                : undefined
            }
            role="combobox"
            className="w-full rounded-lg border border-border-strong bg-surface-sunken py-2.5 pr-3 pl-10 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent-600 focus:bg-surface focus:ring-2 focus:ring-accent-100"
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
      </form>

      {open && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label="Page matches"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-border-subtle bg-surface py-1 shadow-card"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-subtle">
              No matching pages.
            </li>
          ) : (
            hits.map((hit, index) => {
              const active = index === activeIndex
              return (
                <li key={hit.to} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={active}
                    disabled={!hit.implemented}
                    className={
                      active
                        ? 'flex w-full items-center justify-between gap-3 bg-accent-50 px-3 py-2.5 text-left'
                        : 'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-muted'
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goTo(hit)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {hit.label}
                      </span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {hit.section}
                        <span className="text-ink-faint"> · {hit.to}</span>
                      </span>
                    </span>
                    {!hit.implemented ? (
                      <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-ink-subtle uppercase">
                        Soon
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
