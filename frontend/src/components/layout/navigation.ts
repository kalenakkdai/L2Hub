import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavBadge =
  /** A plain count, rendered in mono beside the label. */
  | { kind: 'count'; value: number; tone?: 'accent' | 'muted' }
  /** A pulsing marker for something happening right now. */
  | { kind: 'live' }

export type NavItemDefinition = {
  label: string
  to: string
  icon: LucideIcon
  /** When set, item is shown only if the caller holds this permission. */
  permission?: string
  /** When set, item is hidden if the Campsite has switched this module off. */
  module?: string
  badge?: NavBadge
}

export type NavSection = {
  /** Undefined for the top group, which needs no label. */
  title?: string
  items: NavItemDefinition[]
}

/**
 * Navigation is data, not markup, so the sidebar and the mobile drawer render
 * exactly the same destinations from one source.
 *
 * Badge counts are placeholders until the endpoints that would supply them
 * exist; they are presentational and carry no authorization meaning.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      {
        label: 'Grades',
        to: '/grades',
        module: 'grades',
        icon: BookOpenCheck,
        badge: { kind: 'count', value: 2, tone: 'accent' },
      },
      {
        label: 'Campers',
        to: '/admin/users',
        icon: Users,
        permission: 'users.view',
      },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        label: 'My tasks',
        to: '/tasks',
        icon: ClipboardList,
        badge: { kind: 'count', value: 3, tone: 'accent' },
      },
      {
        label: 'Committees',
        to: '/committees',
        module: 'committees',
        icon: UsersRound,
        badge: { kind: 'count', value: 12, tone: 'muted' },
      },
      { label: 'Events', to: '/events', module: 'events', icon: CalendarDays },
      { label: 'Event planning', to: '/event-planning', icon: ClipboardCheck },
      {
        label: 'Debriefs',
        to: '/debriefs',
        module: 'debriefs',
        icon: MessagesSquare,
        badge: { kind: 'live' },
      },
    ],
  },
  {
    title: 'Leadership',
    items: [
      {
        label: 'Class Officers',
        to: '/class-officers',
        icon: Sparkles,
        permission: 'class_officers.view',
      },
      { label: 'Tools', to: '/tools', icon: Settings2 },
      { label: 'Resources', to: '/resources', icon: BookOpen },
      // Hidden from campers entirely. Advisers see it and get a read-only
      // page; only settings.edit holders can change anything.
      {
        label: 'Campsite settings',
        to: '/settings/campsite',
        icon: SlidersHorizontal,
        permission: 'settings.view',
      },
    ],
  },
  {
    title: 'You',
    items: [{ label: 'My settings', to: '/settings', icon: UserCog }],
  },
]

/** Routes that exist today. Anything else renders as "coming soon". */
export const IMPLEMENTED_ROUTES = new Set([
  '/dashboard',
  '/committees',
  '/settings',
  '/settings/campsite',
  '/grades',
  '/admin/users',
  '/events',
  '/event-planning',
  '/class-officers',
  '/class-officers/fundraiser',
  '/class-officers/homecoming',
  '/debriefs',
  '/dev/health',
])

/**
 * Hides destinations the caller cannot use.
 *
 * Two independent gates: permissions decide what *this camper* may see, and
 * the Campsite's module toggles decide what *anyone* may see. A module that
 * has never been configured counts as on, so a new feature is not invisible
 * until someone remembers to switch it on.
 */
export function filterNavSections(
  sections: NavSection[],
  permissions: string[] | undefined,
  modulesEnabled?: Record<string, boolean>,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.module && modulesEnabled?.[item.module] === false) return false
        if (!item.permission) return true
        return permissions?.includes(item.permission) ?? false
      }),
    }))
    .filter((section) => section.items.length > 0)
}
