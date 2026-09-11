import { Skeleton } from './skeleton'

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-24 rounded mb-2" />
        <Skeleton className="h-3 w-32 rounded" />
      </div>
    </div>
  )
}
