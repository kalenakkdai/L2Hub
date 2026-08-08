import { BookOpenCheck, MessagesSquare, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Shared input treatment for the sign-in and sign-up forms. */
export const FIELD =
  'h-11 w-full rounded-card border border-border-subtle bg-surface px-3 text-[14.5px] text-ink transition duration-200 ease-out-quick outline-none placeholder:text-ink-subtle focus:border-accent-600 focus:ring-[3px] focus:ring-accent-600/13 aria-invalid:border-status-danger'

const PITCH: { icon: LucideIcon; text: string }[] = [
  { icon: MessagesSquare, text: 'Five-minute event debriefs, submitted together' },
  { icon: BookOpenCheck, text: 'Grades that follow from what you actually did' },
  { icon: UsersRound, text: 'Committees, rosters, and assignments that stay straight' },
]

/**
 * The product pitch beside the auth forms.
 *
 * Hidden below lg, where it would push the form under the fold for no
 * benefit — someone signing in already knows what this is.
 */
export function AuthPitch() {
  return (
    <aside className="on-navy hidden flex-col justify-between bg-navy-900 p-14 lg:flex">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent-600 text-[13px] font-bold text-white"
        >
          Q
        </span>
        <span className="font-semibold text-navy-ink">The Quad</span>
      </div>

      <div className="animate-rise-in max-w-[470px] [animation-delay:80ms]">
        <h2 className="text-[46px] leading-[1.08] font-bold tracking-[-0.028em] text-navy-ink">
          Every club gets a Campsite.
        </h2>
        <p className="mt-4 text-[16.5px] leading-relaxed text-navy-ink-muted text-pretty">
          A Campsite is one club&rsquo;s hub on the Quad — its campers, its committees, its
          events, and its work in one place.
        </p>

        <ul className="mt-9 flex flex-col gap-0.5">
          {PITCH.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="-mx-3 flex items-center gap-3.5 rounded-control px-3 py-2.5 transition duration-[260ms] ease-out-quick hover:bg-white/8"
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-400" />
              <span className="text-[14.5px] text-navy-ink-muted">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-9 flex items-center gap-4">
          <span className="font-mono text-[12.5px] text-navy-ink-subtle">
            9 Campsites on the Quad
          </span>
          <span aria-hidden="true" className="dotted-trail-dark h-px flex-1" />
        </div>
      </div>

      <p className="text-[12.5px] text-navy-ink-subtle">
        Mission San Jose High School · Leadership 2
      </p>
    </aside>
  )
}
