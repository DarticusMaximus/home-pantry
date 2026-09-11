import { Skeleton } from './skeleton'

export function LocationCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <Skeleton className="h-6 w-6 rounded" />
      <Skeleton className="h-4 w-16 rounded" />
      <Skeleton className="h-3 w-10 rounded" />
    </div>
  )
}
