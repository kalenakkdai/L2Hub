import {
  ArrowRightLeft,
  CircleCheckBig,
  FileText,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { relativeTime } from './formatDate'
import type { ActivityItem } from './types'

const KIND_ICONS: Record<ActivityItem['kind'], LucideIcon> = {
  grade: CircleCheckBig,
  event: ArrowRightLeft,
  submission: FileText,
  committee: UserPlus,
}

/** Lowest-weight section on the page: muted, dense, scannable. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Recent activity</h3>

      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = KIND_ICONS[item.kind]
          const graded = item.kind === 'grade'

          return (
            <li
              key={item.id}
              className="-mx-2 flex items-center gap-2.5 rounded-[5px] px-2 py-1.5 transition duration-[260ms] ease-out-quick hover:translate-x-0.5 hover:bg-surface-muted"
            >
              <Icon
                aria-hidden="true"
                className={
                  graded
                    ? 'h-[15px] w-[15px] shrink-0 text-accent-ink'
                    : 'h-[15px] w-[15px] shrink-0 text-ink-subtle'
                }
              />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                {item.description}
              </span>
              {item.score !== undefined && (
                <span className="shrink-0 rounded bg-accent-100 px-1.5 py-0.5 font-mono text-[11.5px] text-accent-ink">
                  {item.score}
                </span>
              )}
              <time
                dateTime={item.occurredAt}
                className="shrink-0 text-[12.5px] whitespace-nowrap text-ink-subtle"
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
