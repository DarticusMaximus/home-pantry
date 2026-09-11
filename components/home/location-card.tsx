'use client'

import { getLocationIcon } from '@/lib/constants'
import type { Location } from '@/types/location'

interface LocationCardProps {
  location: Location
  itemCount: number
  onClick: () => void
}

export function LocationCard({ location, itemCount, onClick }: LocationCardProps) {
  const Icon = getLocationIcon(location.icon)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] w-full"
      aria-label={`${location.name}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
    >
      <Icon className="h-6 w-6 text-emerald-600" />
      <span className="text-sm font-medium text-gray-900 truncate w-full text-center">
        {location.name}
      </span>
      <span className="text-xs text-gray-500">
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </span>
    </button>
  )
}
