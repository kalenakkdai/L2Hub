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
 * Only /dashboard, /grades, and /dev/health exist today; the rest are
 * placeholders for the phases that build them, and are marked as such in the UI.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Grades', to: '/grades', icon: BookOpenCheck },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'My tasks', to: '/tasks', icon: ClipboardList },
      { label: 'Committee', to: '/committee', icon: Users },
      { label: 'Events', to: '/events', icon: CalendarDays },
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
  '/dev/health',
])
