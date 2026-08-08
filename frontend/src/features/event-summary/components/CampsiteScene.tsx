import { useCallback, useEffect, useRef, useState } from 'react'
import { owlOverTent } from '../lib/owlTents'
import { Campsite } from './Campsite'
import { NightSky } from './NightSky'
import { Owl } from './Owl'

export type CampsiteSceneProps = {
  /** One tent is pitched per committee. Defaults to the Leadership roster. */
  committees?: string[]
  /** Full-bleed pages (Event Wrapped) have no sidebar to clear. */
  fullBleed?: boolean
  owl?: boolean
}

/** How long a tent's doors stay open after the owl was last over it. */
const DOOR_OPEN_MS = 900

/**
 * The campsite backdrop shared by the events pages: a night sky over a pine
 * forest, a tent for every committee, the L2 Hub campfire, and the owl that
 * glides around the scene.
 *
 * The sky and forest are pinned to the viewport (offset past the desktop
 * sidebar unless the page is full-bleed) so the camp holds still while the
 * page scrolls. Pages that use this must wrap their own content in
 * `relative z-10` to sit above the scene and below the owl.
 */
export function CampsiteScene({
  committees,
  fullBleed = false,
  owl = true,
}: CampsiteSceneProps = {}) {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const [openTents, setOpenTents] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  // Per-tent auto-close timers. A tent stays open while the owl lingers and
  // shuts DOOR_OPEN_MS after the last time it was overhead.
  const closeTimers = useRef<Map<string, number>>(new Map())

  const openDoor = useCallback((name: string) => {
    const timers = closeTimers.current
    const existing = timers.get(name)
    if (existing) window.clearTimeout(existing)
    timers.set(
      name,
      window.setTimeout(() => {
        timers.delete(name)
        setOpenTents((current) => {
          if (!current.has(name)) return current
          const next = new Set(current)
          next.delete(name)
          return next
        })
      }, DOOR_OPEN_MS),
    )

    setOpenTents((current) => {
      if (current.has(name)) return current
      const next = new Set(current)
      next.add(name)
      return next
    })
  }, [])

  const handleOwlSweep = useCallback(
    (owlRect: DOMRect) => {
      const root = backdropRef.current
      if (!root) return
      root.querySelectorAll<SVGGElement>('[data-tent]').forEach((node) => {
        const name = node.getAttribute('data-tent')
        if (!name) return
        if (owlOverTent(owlRect, node.getBoundingClientRect())) {
          openDoor(name)
        }
      })
    },
    [openDoor],
  )

  useEffect(() => {
    const timers = closeTimers.current
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
    }
  }, [])

  return (
    <>
      <div
        ref={backdropRef}
        className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${
          fullBleed ? '' : 'lg:left-64'
        }`}
      >
        <NightSky />
        <Campsite committees={committees} openTents={openTents} />
      </div>
      {owl ? <Owl onSweep={handleOwlSweep} /> : null}
    </>
  )
}
