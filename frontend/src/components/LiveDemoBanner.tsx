import { useLocation } from 'react-router-dom'

/**
 * TEMPORARY — live demo only. Delete this file and its import in App.tsx
 * after the demo (planned ~2 hours from when it was added).
 *
 * Hardcoded page blurbs so every route shows a visible demo marker.
 */
const DEMO_BLURBS: { match: (path: string) => boolean; text: string }[] = [
  { match: (p) => p === '/login', text: 'Sign in · use a seeded demo account' },
  { match: (p) => p === '/signup', text: 'Sign up · demo signup flow' },
  { match: (p) => p === '/photographer', text: 'Photographer drop · public demo upload' },
  { match: (p) => p === '/dashboard' || p === '/', text: 'Dashboard · sample grade standing + fixture content' },
  { match: (p) => p.startsWith('/grades'), text: 'Grades · mock gradebook data for the demo' },
  { match: (p) => p === '/owl', text: 'Owl rewards · A+ cosmetics demo' },
  { match: (p) => p === '/board', text: 'L2 Board · live committee task columns' },
  { match: (p) => p === '/requests', text: 'Requests · cross-committee ask log' },
  { match: (p) => p === '/inbox', text: 'Inbox · personal notifications' },
  { match: (p) => p.startsWith('/committees'), text: 'Committees · roster + committee home' },
  { match: (p) => p.startsWith('/events') || p.startsWith('/wrapped') || p.startsWith('/agenda'), text: 'Events · Maze Day workflow surface' },
  { match: (p) => p.startsWith('/event-planning'), text: 'Event planning · mock plan adapter' },
  { match: (p) => p.startsWith('/debriefs') || p.startsWith('/live'), text: 'Debriefs · live session / bubbles' },
  { match: (p) => p.startsWith('/attendance') || p.startsWith('/whereabouts'), text: 'Attendance · check-in + whereabouts' },
  { match: (p) => p.startsWith('/note-taker'), text: 'Note Taker · meeting notes demo' },
  { match: (p) => p.startsWith('/messenger-agenda'), text: 'Messenger Agenda · keyword agenda demo' },
  { match: (p) => p.startsWith('/class-officers'), text: 'Class Officers · mock fundraiser / homecoming' },
  { match: (p) => p.startsWith('/admin'), text: 'Admin · users + roles' },
  { match: (p) => p.startsWith('/settings'), text: 'Settings · profile + campsite modules' },
  { match: (p) => p.startsWith('/tools'), text: 'Tools · utility index' },
  { match: (p) => p.startsWith('/dev'), text: 'Dev health · API smoke check' },
]

function blurbFor(pathname: string): string {
  for (const row of DEMO_BLURBS) {
    if (row.match(pathname)) return row.text
  }
  return `${pathname} · live demo page`
}

export function LiveDemoBanner() {
  const { pathname } = useLocation()
  const blurb = blurbFor(pathname)

  return (
    <div
      role="status"
      data-live-demo-banner
      className="fixed inset-x-0 top-0 z-[200] flex h-10 items-center justify-center gap-3 border-b border-status-warning-border bg-status-warning-bg px-4 text-center text-[12.5px] font-semibold tracking-wide text-status-warning"
    >
      <span className="uppercase tracking-[0.08em]">Live demo</span>
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <span className="max-w-[70vw] truncate font-medium normal-case tracking-normal text-ink">
        {blurb}
      </span>
      <span className="hidden text-[11px] font-medium opacity-70 sm:inline">
        (temporary — remove after demo)
      </span>
    </div>
  )
}

/** Height of {@link LiveDemoBanner}; keep in sync with `h-10` above. */
export const LIVE_DEMO_BANNER_OFFSET = 'pt-10'
