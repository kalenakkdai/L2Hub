/**
 * Shared SVG filters for the live debrief bubbles.
 *
 * Defined once and referenced by every bubble: a turbulence displacement pass
 * is what makes the soap film crawl like liquid rather than sit still, and one
 * shared filter keeps 50 bubbles from each compiling their own.
 */
export function BubbleFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {/* Slow-crawling distortion for the iridescent film. */}
        <filter id="bubble-liquid" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014 0.021"
            numOctaves={2}
            seed={11}
            result="filmNoise"
          >
            <animate
              attributeName="baseFrequency"
              dur="24s"
              values="0.014 0.021;0.022 0.014;0.014 0.021"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="filmNoise"
            scale={9}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Faster, shallower wobble for the surface sheen. */}
        <filter id="bubble-sheen" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves={1}
            seed={4}
            result="sheenNoise"
          >
            <animate
              attributeName="baseFrequency"
              dur="14s"
              values="0.03;0.045;0.03"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="sheenNoise"
            scale={5}
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </defs>
    </svg>
  )
}
