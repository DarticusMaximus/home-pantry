import { Skeleton } from './skeleton'

export function TemplateCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <Skeleton className="h-5 w-28 mb-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}
