/**
 * Customizable snowy owl — same silhouette as the campsite owl, with reward
 * cosmetics (belly/wing colors, scarf/glasses/laurels, sparkle/leaf trail).
 */

import type { OwlCosmetics } from './api'

const SIZE = 160

type CustomOwlProps = {
  cosmetics: OwlCosmetics
  size?: number
  className?: string
  label?: string
}

export function CustomOwl({
  cosmetics,
  size = SIZE,
  className,
  label = 'Your customized owl',
}: CustomOwlProps) {
  const belly = cosmetics.palette.belly
  const wing = cosmetics.palette.wing
  const gradientId = `owl-belly-${cosmetics.bellyColor}`

  return (
    <div className={['relative inline-block', className].filter(Boolean).join(' ')}>
      {cosmetics.trail === 'sparkles' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-12%] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.35),transparent_65%)]"
        />
      ) : null}
      {cosmetics.trail === 'leaves' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-emerald-700/25 blur-[2px]"
        />
      ) : null}

      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={label}
        className="drop-shadow-[0_8px_18px_rgb(5_9_15_/_0.45)]"
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor={belly.fill} />
            <stop offset="100%" stopColor={belly.fillDeep} />
          </radialGradient>
        </defs>

        <ellipse cx="32" cy="36" rx="24" ry="21" fill={belly.fill} opacity="0.14" />
        <ellipse cx="32" cy="36" rx="16" ry="17" fill={`url(#${gradientId})`} />

        <path d="M20 24 L18 13 L27 20 Z" fill={belly.fill} />
        <path d="M44 24 L46 13 L37 20 Z" fill={belly.fill} />

        <g fill={wing.far} opacity="0.75">
          <circle cx="32" cy="47" r="1.5" />
          <circle cx="28.5" cy="42" r="1.5" />
          <circle cx="35.5" cy="42" r="1.5" />
        </g>

        <path
          d="M22 28.5 C15.5 30.5 11.5 36 12.5 43 C13.2 48 15.5 51.5 18 53 C21.5 49.5 24.2 44 24.7 38 C25 33.5 24 30.2 22 28.5 Z"
          fill={wing.far}
        />
        <path
          d="M42 28.5 C48.5 30.5 52.5 36 51.5 43 C50.8 48 48.5 51.5 46 53 C42.5 49.5 39.8 44 39.3 38 C39 33.5 40 30.2 42 28.5 Z"
          fill={wing.near}
        />

        <circle cx="25.5" cy="31" r="6.4" fill={belly.fill} />
        <circle cx="38.5" cy="31" r="6.4" fill={belly.fill} />
        <circle cx="25.5" cy="31" r="4.2" fill="#1b2a42" />
        <circle cx="38.5" cy="31" r="4.2" fill="#1b2a42" />
        <circle cx="27" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
        <circle cx="40" cy="29.5" r="1.5" fill="#ffffff" opacity="0.95" />
        <path d="M32 33 L34.6 37 L29.4 37 Z" fill="#f59e0b" />

        {cosmetics.accessory === 'scarf' ? (
          <path
            d="M22 44 C28 48 36 48 42 44 L40 52 C34 49 28 49 24 52 Z"
            fill="#b91c1c"
            opacity="0.92"
          />
        ) : null}
        {cosmetics.accessory === 'glasses' ? (
          <g fill="none" stroke="#1b2a42" strokeWidth="1.2">
            <circle cx="25.5" cy="31" r="5.2" />
            <circle cx="38.5" cy="31" r="5.2" />
            <path d="M30.7 31 H33.3" />
          </g>
        ) : null}
        {cosmetics.accessory === 'laurels' ? (
          <g fill="none" stroke="#ca8a04" strokeWidth="1.3" strokeLinecap="round">
            <path d="M18 40 C16 34 18 28 22 24" />
            <path d="M46 40 C48 34 46 28 42 24" />
            <path d="M19 36 L16 34 M20 32 L17 29 M21 28 L19 25" />
            <path d="M45 36 L48 34 M44 32 L47 29 M43 28 L45 25" />
          </g>
        ) : null}

        {cosmetics.trail === 'sparkles' ? (
          <g fill="#fbbf24">
            <circle cx="10" cy="22" r="1.2" />
            <circle cx="54" cy="26" r="1" />
            <circle cx="8" cy="40" r="0.9" />
            <circle cx="56" cy="44" r="1.1" />
          </g>
        ) : null}
        {cosmetics.trail === 'leaves' ? (
          <g fill="#4d7c0f" opacity="0.85">
            <ellipse cx="12" cy="48" rx="3" ry="1.6" transform="rotate(-25 12 48)" />
            <ellipse cx="52" cy="50" rx="3" ry="1.6" transform="rotate(20 52 50)" />
          </g>
        ) : null}
      </svg>
    </div>
  )
}
