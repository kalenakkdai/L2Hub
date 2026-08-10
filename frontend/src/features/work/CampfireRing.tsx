/**
 * Rotating circle of event campfires for My Tasks.
 *
 * Fires sit on a slowly spinning ring so every event gets a turn at the front.
 * Each fire counter-rotates so its label stays upright. Pressing a fire hands
 * its on-screen centre back to the parent so the owl can fly there.
 */

import { useRef } from 'react'
import { TinyCampfire } from '../note-taker/components/TinyCampfire'
import type { MyTasksCampfire } from './api'

type CampfireRingProps = {
  campfires: MyTasksCampfire[]
  selectedId: string | null
  paused: boolean
  onSelect: (campfire: MyTasksCampfire, point: { x: number; y: number }) => void
}

/** Evenly space fires around a unit circle, starting at the top. */
export function ringPositions(
  count: number,
): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    return {
      x: 50 + Math.cos(angle) * 42,
      y: 50 + Math.sin(angle) * 42,
    }
  })
}

export function CampfireRing({
  campfires,
  selectedId,
  paused,
  onSelect,
}: CampfireRingProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const positions = ringPositions(campfires.length)

  return (
    <div
      ref={stageRef}
      className="relative mx-auto aspect-square w-full max-w-md"
    >
      <div
        className={[
          'absolute inset-0',
          paused ? '' : 'my-tasks-orbit',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[14%] rounded-full border border-amber-900/25 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.14),transparent_68%)]"
        />

        <ul className="absolute inset-0 list-none" aria-label="Event campfires">
          {campfires.map((campfire, index) => {
            const spot = positions[index]
            if (!spot) return null
            const selected = campfire.event.id === selectedId
            return (
              <li
                key={campfire.event.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              >
                <button
                  type="button"
                  className={[
                    'rounded-control p-2 text-center',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
                    selected ? 'scale-110' : 'hover:scale-105',
                    paused ? '' : 'my-tasks-orbit-counter',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={selected}
                  aria-label={`${campfire.event.name} ${campfire.event.year}, ${campfire.progress.percentComplete}% complete`}
                  onClick={(event) => {
                    const stage = stageRef.current
                    if (!stage) return
                    const stageBox = stage.getBoundingClientRect()
                    const box = event.currentTarget.getBoundingClientRect()
                    onSelect(campfire, {
                      x: box.left + box.width / 2 - stageBox.left,
                      y: box.top + box.height / 2 - stageBox.top,
                    })
                  }}
                >
                  <TinyCampfire
                    size={selected ? 72 : 58}
                    seed={index + 1}
                    logCount={Math.max(
                      1,
                      campfire.myTasks.length + campfire.progress.done,
                    )}
                    banked={campfire.tone === 'next'}
                    label={`${campfire.event.name} campfire`}
                  />
                  <span className="mt-1 block max-w-[7.5rem] text-xs font-semibold text-amber-50 drop-shadow">
                    {campfire.event.name}
                  </span>
                  <span className="block text-[10px] tabular-nums text-amber-100/80">
                    {campfire.progress.percentComplete}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <style>{`
        .my-tasks-orbit {
          animation: myTasksOrbitSpin 48s linear infinite;
        }
        .my-tasks-orbit-counter {
          animation: myTasksOrbitSpin 48s linear infinite reverse;
        }
        @keyframes myTasksOrbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .my-tasks-orbit,
          .my-tasks-orbit-counter {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
