import { cn } from './cn'
import { Card } from './Card'

/** A single shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-status-neutral-bg', className)} />
}

/**
 * Card-shaped placeholder. Mirrors the real card's padding and line rhythm so
 * content does not jump when it loads.
 */
export function SkeletonCard({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      <Skeleton className="h-9 w-9 rounded-control" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('mt-2 h-3', index === lines - 1 ? 'w-1/2' : 'w-full')}
        />
      ))}
    </Card>
  )
}
