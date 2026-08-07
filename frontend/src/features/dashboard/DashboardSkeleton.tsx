import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'

/**
 * Mirrors the real layout's shape so content does not jump when it arrives.
 * role=status + aria-busy tell assistive tech that this is a wait, not a page.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading your dashboard…</span>

      {/* Next event hero */}
      <div>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-2 h-px w-full" />
        <Skeleton className="mt-4 h-52 w-full rounded-panel" />
      </div>

      {/* Needs your attention */}
      <div>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-px w-full" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="flex items-center gap-4 p-5">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0" />
            </Card>
          ))}
        </div>
      </div>

      {/* Progress + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <Skeleton className="mt-5 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  )
}
