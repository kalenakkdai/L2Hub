import { NightSky } from './NightSky'
import { Owl } from './Owl'

/**
 * The campsite backdrop shared by the events pages: a fixed night sky behind
 * the content column plus the owl that perches around it.
 *
 * Both layers are fixed to the viewport (offset past the desktop sidebar) so
 * the scene holds still while the page scrolls. Pages that use this must wrap
 * their own content in `on-navy relative z-10` to sit above the sky and below
 * the owl.
 */
export function CampsiteScene() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 lg:left-64">
        <NightSky />
      </div>
      <Owl />
    </>
  )
}
