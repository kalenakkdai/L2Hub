import {
  filterNavSections,
  IMPLEMENTED_ROUTES,
  NAV_SECTIONS,
  type NavItemDefinition,
} from '../../../components/layout/navigation'

export type SiteSearchHit = {
  label: string
  to: string
  section: string
  /** True when the route exists today; false rows stay visible but inert. */
  implemented: boolean
}

/** Extra phrases people type that are not already in the nav label. */
const ALIASES: Record<string, string[]> = {
  '/dashboard': ['home', 'overview', 'main'],
  '/grades': ['gradebook', 'scores', 'assignments', 'rubric'],
  '/admin/users': ['users', 'people', 'roster', 'members', 'campers'],
  '/committees': ['teams', 'groups'],
  '/events': ['wrapped', 'happening', 'calendar', 'fall rally'],
  '/event-planning': ['plans', 'agenda', 'planning'],
  '/debriefs': ['live debrief', 'bubbles', 'session'],
  '/class-officers': ['fundraiser', 'homecoming', 'advisors'],
  '/attendance': ['check in', 'scanner', 'barcode', 'passkey', 'id'],
  '/whereabouts': ['map', 'errand', 'checkout', 'ping'],
  '/tools': ['utilities'],
  '/note-taker': ['notes', 'otter', 'transcript', 'meeting', 'record', 'mic'],
  '/settings': ['profile', 'account', 'preferences'],
  '/settings/campsite': ['modules', 'admin settings'],
}

type IndexedDestination = {
  item: NavItemDefinition
  section: string
  haystack: string
}

function flattenDestinations(): IndexedDestination[] {
  const rows: IndexedDestination[] = []
  for (const section of NAV_SECTIONS) {
    const sectionLabel = section.title ?? 'Main'
    for (const item of section.items) {
      const aliases = ALIASES[item.to] ?? []
      const haystack = [item.label, item.to, sectionLabel, ...aliases]
        .join(' ')
        .toLowerCase()
      rows.push({ item, section: sectionLabel, haystack })
    }
  }
  return rows
}

const INDEX = flattenDestinations()

/**
 * Ranked navigation matches for the dashboard search bar.
 *
 * Respects the same permission and module gates as the sidebar. Empty queries
 * return a short starter list so the field still helps discovery on focus.
 */
export function searchSiteDestinations(
  query: string,
  permissions: string[] | undefined,
  modulesEnabled?: Record<string, boolean>,
  limit = 8,
): SiteSearchHit[] {
  const allowed = new Set(
    filterNavSections(NAV_SECTIONS, permissions, modulesEnabled).flatMap(
      (section) => section.items.map((item) => item.to),
    ),
  )

  const visible = INDEX.filter((row) => allowed.has(row.item.to))
  const trimmed = query.trim().toLowerCase()

  if (!trimmed) {
    return visible.slice(0, limit).map(toHit)
  }

  const scored = visible
    .map((row) => {
      const label = row.item.label.toLowerCase()
      let score = 0
      if (label === trimmed) score = 100
      else if (label.startsWith(trimmed)) score = 80
      else if (label.includes(trimmed)) score = 60
      else if (row.haystack.includes(trimmed)) score = 40
      else {
        const tokens = trimmed.split(/\s+/).filter(Boolean)
        if (tokens.length > 0 && tokens.every((token) => row.haystack.includes(token))) {
          score = 30
        }
      }
      return { row, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.item.label.localeCompare(b.row.item.label))

  return scored.slice(0, limit).map((entry) => toHit(entry.row))
}

function toHit(row: IndexedDestination): SiteSearchHit {
  return {
    label: row.item.label,
    to: row.item.to,
    section: row.section,
    implemented: IMPLEMENTED_ROUTES.has(row.item.to),
  }
}
