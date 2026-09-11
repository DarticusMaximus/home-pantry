'use client'

import { Edit2, MapPin, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getLocationIcon } from '@/lib/constants'
import type { Location } from '@/types/location'

interface LocationsListProps {
  locations: Location[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdd?: () => void
}

export function LocationsList({ locations, onEdit, onDelete, onAdd }: LocationsListProps) {
  const sortedLocations = [...locations].sort((a, b) => a.sortOrder - b.sortOrder)

  if (locations.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        heading="No locations yet"
        body="Add one to organize your pantry items."
        action={onAdd ? { label: 'Add location', onClick: onAdd } : undefined}
      />
    )
  }

  return (
    <ul className="space-y-4">
      {sortedLocations.map((location) => {
        const Icon = getLocationIcon(location.icon)
        return (
          <li
            key={location.id}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{location.name}</p>
                {location.description && (
                  <p className="text-sm text-gray-500 truncate">{location.description}</p>
                )}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEdit(location.id)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={`Edit ${location.name}`}
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(location.id)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete ${location.name}`}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
