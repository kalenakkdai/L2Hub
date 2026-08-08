import { useState } from 'react'
import type { PlanningRagResult } from '../types'
import { usePlanningCommands } from '../hooks/useEventPlanning'

export function PlanningRagPanel() {
  const [query, setQuery] = useState('Maze Day stations and setup')
  const { searchKnowledge } = usePlanningCommands()
  const result = searchKnowledge.data as PlanningRagResult | undefined

  return (
    <section
      aria-labelledby="planning-rag-heading"
      className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
    >
      <h2
        id="planning-rag-heading"
        className="text-sm font-semibold text-ink"
      >
        Agenda knowledge assist
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Search past agendas and event notes, then generate a planning outline.
        Uses the local Leadership knowledge base — no paid API.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="planning-rag-query">
          Search past events
        </label>
        <input
          id="planning-rag-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          placeholder="Search old events (e.g. Maze Day, Rally, Formal)"
        />
        <button
          type="button"
          className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
          disabled={searchKnowledge.isPending || !query.trim()}
          onClick={() => searchKnowledge.mutate(query.trim())}
        >
          {searchKnowledge.isPending ? 'Searching…' : 'Search & outline'}
        </button>
      </div>

      {searchKnowledge.isError ? (
        <p className="mt-3 text-sm text-status-danger" role="alert">
          {searchKnowledge.error instanceof Error
            ? searchKnowledge.error.message
            : 'Search failed'}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
              Matching past events
            </h3>
            {result.hits.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No historical events matched that search.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {result.hits.map((hit) => (
                  <li
                    key={hit.id}
                    className="rounded-control border border-border-subtle bg-surface-sunken px-3 py-2"
                  >
                    <p className="text-sm font-medium text-ink">
                      {hit.name} {hit.year}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{hit.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result.outline ? (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                Auto-generated planning outline
              </h3>
              <p className="mt-2 text-sm text-ink-muted">
                {result.outline.guideline}
              </p>
              <ol className="mt-3 space-y-3">
                {result.outline.sections.map((section) => (
                  <li key={section.title}>
                    <p className="text-sm font-semibold text-ink">
                      {section.title}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
