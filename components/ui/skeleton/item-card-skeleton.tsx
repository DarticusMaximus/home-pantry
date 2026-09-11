import { Skeleton } from './skeleton'

export function ItemCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl bg-white shadow-sm border border-gray-100">
      <div className="flex flex-col p-4 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-11 w-11 rounded-lg ml-4" />
        </div>
      </div>
      <div className="px-4 pb-4 flex items-center gap-2">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
    </div>
  )
}

export const ITEM_CARD_SKELETON_KEYS = ['ics-0', 'ics-1', 'ics-2', 'ics-3'] as const
