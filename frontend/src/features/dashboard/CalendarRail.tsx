import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'
import { dayOfMonth, weekdayShort } from './formatDate'
import type { CalendarDay } from './types'

/**
 * A horizontally scrolling strip of the next two weeks, hung beneath the
 * dotted trail. Days with something scheduled are wider than quiet ones, so
 * the shape of the fortnight is legible before any text is read.
 */
export function CalendarRail({ days }: { days: CalendarDay[] }) {
  const rail = useRef<HTMLDivElement>(null)

  const nudge = (direction: 1 | -1) => () =>
    rail.current?.scrollBy({ left: direction * 300, behavior: 'smooth' })

  return (
    <div>
      <div className="mt-5 mb-2.5 flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-ink-subtle">Next two weeks</span>
        <div className="flex gap-1.5">
          <Button variant="icon" size="sm" className="w-8 px-0" onClick={nudge(-1)}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Scroll calendar back</span>
          </Button>
          <Button variant="icon" size="sm" className="w-8 px-0" onClick={nudge(1)}>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Scroll calendar forward</span>
          </Button>
        </div>
      </div>

      <div ref={rail} className="-mx-1.5 overflow-x-auto px-1.5 pt-2.5 pb-4">
        <div className="flex w-max min-w-full flex-col gap-2">
          {/* The trail runs behind the strip, with a marker on today. */}
          <div className="relative h-2">
            <span aria-hidden="true" className="dotted-trail absolute inset-x-0 top-[3px] h-px" />
            <span
              aria-hidden="true"
              className="absolute top-0 left-[52px] h-2 w-2 rounded-full bg-accent-600 ring-[3px] ring-surface"
            />
          </div>

          <ul className="flex gap-2">
            {days.map((day) => {
              const scheduled = Boolean(day.title)

              return (
                <li
                  key={day.date}
                  className={cn(
                    'shrink-0 rounded-card border p-3 transition duration-[420ms] ease-out-quick hover:-translate-y-[3px] hover:shadow-card-hover hover:duration-[260ms]',
                    scheduled ? 'w-[200px]' : 'w-28',
                    day.isToday
                      ? 'border-border-subtle bg-surface-muted'
                      : scheduled
                        ? 'border-accent-200 bg-accent-50'
                        : 'border-border-subtle bg-surface',
                  )}
                >
                  <div
                    className={cn(
                      'text-[11.5px] font-semibold',
                      scheduled && !day.isToday ? 'text-accent-700' : 'text-ink-subtle',
                    )}
                  >
                    {weekdayShort(day.date)}
                  </div>
                  <div className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink">
                    {dayOfMonth(day.date)}
                  </div>

                  {day.isToday && <div className="mt-1.5 text-xs text-ink-subtle">Today</div>}

                  {day.title && (
                    <>
                      <div className="mt-1.5 text-[12.5px] font-medium text-ink">
                        {day.title}
                      </div>
                      {day.detail && (
                        <div className="text-xs text-ink-muted">{day.detail}</div>
                      )}
                    </>
                  )}

                  {!day.title && !day.isToday && (
                    <div className="mt-1.5 text-xs text-ink-faint">Nothing yet</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
