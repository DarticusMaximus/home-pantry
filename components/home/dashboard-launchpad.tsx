'use client'

import { CheckCircle } from 'lucide-react'
import { LocationCard } from '@/components/home/location-card'
import { LocationCardSkeleton } from '@/components/ui/skeleton/location-card-skeleton'
import { isExpiringSoon } from '@/lib/utils/expiration'
import type { Category } from '@/types/category'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'

interface DashboardLaunchpadProps {
  items: Item[]
  locations: Location[]
  categories: Category[]
  isLoading: boolean
  onExpiringClick: () => void
  onLocationClick: (locationId: string) => void
}

const LOCATION_SKELETON_KEYS = ['loc-skel-0', 'loc-skel-1', 'loc-skel-2', 'loc-skel-3'] as const

export function DashboardLaunchpad({
  items,
  locations,
  isLoading,
  onExpiringClick,
  onLocationClick,
}: DashboardLaunchpadProps) {
  const itemCount = items.length
  const expiringCount = items.filter((item) => isExpiringSoon(item.expirationDate)).length

  const getItemCountsByLocation = (locationId: string) =>
    items.filter((i) => i.locationId === locationId).length

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LOCATION_SKELETON_KEYS.map((key) => (
            <LocationCardSkeleton key={key} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        {expiringCount > 0 ? (
          <button
            type="button"
            onClick={onExpiringClick}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-100 active:bg-amber-200 transition-colors min-h-[44px]"
            aria-label={`${expiringCount} items expiring soon. Tap to filter.`}
          >
            {expiringCount} expiring
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            <CheckCircle className="h-4 w-4" />
            All good
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {locations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            itemCount={getItemCountsByLocation(location.id)}
            onClick={() => onLocationClick(location.id)}
          />
        ))}
      </div>
    </div>
  )
}
