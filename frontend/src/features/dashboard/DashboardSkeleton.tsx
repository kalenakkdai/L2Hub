import { Card } from '../../components/ui/Card'
import { Skeleton, SkeletonCard } from '../../components/ui/Skeleton'

/**
 * Mirrors the real layout's shape so content does not jump when it arrives.
 * role=status + aria-busy tell assistive tech that this is a wait, not a page.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading your dashboard…</span>

      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-48" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-6 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-6 h-10 w-28" />
        </Card>

        <Card className="p-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-6 w-32" />
          <Skeleton className="mt-6 h-8 w-24" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <Skeleton className="mt-6 h-4 w-40" />
        </Card>
      </div>

      <div>
        <Skeleton className="h-3 w-28" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
