import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  MessagesSquare,
  ShieldQuestion,
  Sparkles,
  Timer,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Explicit map rather than a dynamic lookup, so the bundler only ships the
 * icons actually used and an unknown name cannot crash a card.
 */
const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  MessagesSquare,
  ShieldQuestion,
  Sparkles,
  Timer,
  UserCheck,
  Users,
}

export function moduleIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutGrid
}
