import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { cn } from '../../components/ui/cn'
import { countdown, dayLabel } from './formatDate'
import type { NextEvent, PrepItem } from './types'

function PrepRow({ item, onToggle }: { item: PrepItem; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={item.done}
      className={cn(
        'group -mx-2 flex w-full items-center gap-2.5 rounded-[5px] px-2 py-[5px] text-left transition duration-[260ms] ease-out-quick hover:bg-white/8',
        item.done && 'opacity-55',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition duration-200 ease-out-quick',
          item.done ? 'border-white bg-white' : 'border-white/45',
        )}
      >
        {/* The tick draws itself in rather than popping. */}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 overflow-visible">
          <path
            d="M3.5 8.4 6.6 11.4 12.5 5"
            fill="none"
            stroke="#12372A"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: item.done ? 0 : 24,
              transition: 'stroke-dashoffset 200ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        </svg>
      </span>
      <span className={cn('text-[13.5px] text-white/85', item.done && 'line-through')}>
        {item.label}
      </span>
    </button>
  )
}

/**
 * The single most saturated element on the page: what is happening next, what
 * this camper is doing at it, and what is left to prepare.
 *
 * Prep toggles are local state. They are a design concept with no table
 * behind them yet, so nothing is persisted and nothing is claimed to be.
 */
export function NextEventCard({ event }: { event: NextEvent }) {
  const [prep, setPrep] = useState(event.prep)

  const doneCount = prep.filter((item) => item.done).length
  const until = countdown(event.startsAt)

  const toggle = (id: string) =>
    setPrep((current) =>
      current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )

  return (
    <article className="on-navy relative overflow-hidden rounded-panel bg-accent-600 p-6 text-white shadow-card sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h3 className="text-hero font-bold">{event.title}</h3>
          <p className="mt-1 text-[15px] text-white/72">
            {dayLabel(event.startsAt)} · {event.window}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[15px] text-white/72">
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
            {event.location}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3.5">
            {until && (
              <span className="inline-flex items-baseline gap-2 rounded-[7px] bg-white/10 px-3.5 py-2.5 font-mono">
                <span className="text-xl font-medium">{until}</span>
                <span className="text-[11px] tracking-[0.12em] text-white/60 uppercase">
                  to start
                </span>
              </span>
            )}
            <ButtonLink to={event.to} variant="light" size="lg">
              Event brief
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>

        <div className="border-white/14 lg:border-l lg:pl-8">
          <h4 className="text-[12.5px] font-semibold text-white/55">Your role</h4>
          <p className="mt-2 font-semibold text-white">{event.assignment.title}</p>
          <p className="mt-0.5 text-[13px] text-white/60">{event.assignment.detail}</p>

          <div className="mt-5 mb-2.5 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-white/55">Prep</span>
            <span className="text-[12.5px] font-medium text-white/82">
              {doneCount} of {prep.length}
            </span>
          </div>

          <ProgressBar
            onDark
            className="mb-3.5"
            value={doneCount}
            max={prep.length}
            label={`Event preparation, ${doneCount} of ${prep.length} done`}
          />

          <div className="flex flex-col gap-0.5">
            {prep.map((item) => (
              <PrepRow key={item.id} item={item} onToggle={() => toggle(item.id)} />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
