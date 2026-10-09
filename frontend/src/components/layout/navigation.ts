import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Mic,
  MapPinned,
  ScanLine,
  Send,
  SlidersHorizontal,
  Sparkles,
  SquareKanban,
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
 * Grouped by what a camper is trying to do: their own work first, then the
 * class's shared work, then events from plan to debrief, then the staff-only
 * surfaces. Counts only appear where a real number exists — the Inbox badge is
 * supplied live by the sidebar.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Inbox', to: '/inbox', icon: Inbox },
      {
        label: 'My tasks',
        to: '/tasks',
        icon: ClipboardList,
        permission: 'tasks.view_all',
      },
      { label: 'Grades', to: '/grades', module: 'grades', icon: BookOpenCheck },
    ],
  },
  {
    title: 'Work',
    items: [
      // Both are readable by the whole class — tasks.view_all and
      // requests.view_all are in the Member baseline. The keys stay on the
      // items so the rows follow the grants if that ever changes.
      {
        label: 'L2 Board',
        to: '/board',
        icon: SquareKanban,
        permission: 'tasks.view_all',
      },
      {
        label: 'Requests',
        to: '/requests',
        icon: Send,
        permission: 'requests.view_all',
      },
      {
        label: 'Committees',
        to: '/committees',
        module: 'committees',
        icon: UsersRound,
      },
    ],
  },
  {
    title: 'Events',
    items: [
      { label: 'Events', to: '/events', module: 'events', icon: CalendarDays },
      { label: 'Event planning', to: '/event-planning', icon: ClipboardCheck },
      {
        label: 'Debriefs',
        to: '/debriefs',
        module: 'debriefs',
        icon: MessagesSquare,
      },
      {
        label: 'Note Taker',
        to: '/note-taker',
        icon: Mic,
        permission: 'note_taker.view',
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
      {
        label: 'Attendance',
        to: '/attendance',
        icon: ScanLine,
        permission: 'attendance.manage_all',
      },
      {
        label: 'Whereabouts map',
        to: '/whereabouts',
        icon: MapPinned,
        permission: 'attendance.view_committee',
      },
      {
        label: 'Campers',
        to: '/admin/users',
        icon: Users,
        permission: 'users.view',
      },
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
  '/tasks',
  '/board',
  '/requests',
  '/inbox',
  '/committees',
  '/settings',
  '/settings/campsite',
  '/grades',
  '/admin/users',
  '/events',
  '/event-planning',
  '/attendance',
  '/whereabouts',
  '/tools',
  '/note-taker',
  '/note-taker/new',
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
