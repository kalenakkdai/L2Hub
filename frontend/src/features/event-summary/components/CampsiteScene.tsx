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
  return (
    <>
      <div
        className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${
          fullBleed ? '' : 'lg:left-64'
        }`}
      >
        <NightSky />
        <Campsite committees={committees} />
      </div>
      {owl ? <Owl /> : null}
    </>
  )
}
