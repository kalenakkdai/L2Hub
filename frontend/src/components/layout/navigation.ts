import {
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  Settings2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItemDefinition = {
  label: string
  to: string
  icon: LucideIcon
  /** When set, item is shown only if the caller holds this permission. */
  permission?: string
}

export type NavSection = {
  /** Undefined for the top group, which needs no label. */
  title?: string
  items: NavItemDefinition[]
}

/**
 * Navigation is data, not markup, so the sidebar and the mobile drawer render
 * exactly the same destinations from one source.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Grades', to: '/grades', icon: BookOpenCheck },
      {
        label: 'Users',
        to: '/admin/users',
        icon: Users,
        permission: 'users.view',
      },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'My tasks', to: '/tasks', icon: ClipboardList },
      { label: 'Committee', to: '/committee', icon: Users },
      { label: 'Events', to: '/events', icon: CalendarDays },
      { label: 'Event planning', to: '/event-planning', icon: ClipboardList },
      { label: 'Debriefs', to: '/debriefs', icon: MessagesSquare },
    ],
  },
  {
    title: 'Leadership',
    items: [{ label: 'Tools', to: '/tools', icon: Settings2 }],
  },
]

/** Routes that exist today. Anything else renders as "coming soon". */
export const IMPLEMENTED_ROUTES = new Set([
  '/dashboard',
  '/grades',
  '/admin/users',
  '/events',
  '/event-planning',
  '/debriefs',
  '/dev/health',
])

export function filterNavSections(
  sections: NavSection[],
  permissions: string[] | undefined,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.permission) return true
        return permissions?.includes(item.permission) ?? false
      }),
    }))
    .filter((section) => section.items.length > 0)
}
