import {
  CalendarCheck,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { relativeTime } from './formatDate'
import type { ActivityItem } from './types'

const KIND_ICONS: Record<ActivityItem['kind'], LucideIcon> = {
  points: Sparkles,
  event: CalendarCheck,
  submission: FileText,
  committee: Users,
  level: TrendingUp,
}

/** Lowest-weight section on the page: muted, dense, scannable. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-2">
      <ul className="divide-y divide-border-subtle">
        {items.map((item) => {
          const Icon = KIND_ICONS[item.kind]

          return (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-neutral-bg">
                <Icon aria-hidden="true" className="h-3.5 w-3.5 text-ink-subtle" />
              </span>

              <p className="flex-1 text-sm text-ink">{item.description}</p>

              <time
                dateTime={item.occurredAt}
                className="shrink-0 pt-0.5 text-label text-ink-subtle whitespace-nowrap"
              >
                {relativeTime(item.occurredAt)}
              </time>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
