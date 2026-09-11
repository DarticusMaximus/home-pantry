'use client'

import { AlertTriangle, MapPin, Package, Pencil } from 'lucide-react'
import Link from 'next/link'
import { getExpirationStatus } from '@/lib/utils/expiration'
import type { Category } from '@/types/category'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'
import { QuantityControls } from './quantity-controls'

interface ItemCardProps {
  item: Item
  location?: Location
  category?: Category
  onEdit?: () => void
  onIncrement: () => void
  onDecrement: () => void
  onPartialUse: (amountToRemove: number) => void
}

export function ItemCard({
  item,
  location,
  category,
  onEdit,
  onIncrement,
  onDecrement,
  onPartialUse,
}: ItemCardProps) {
  const expirationStatus = getExpirationStatus(item.expirationDate)

  return (
    <div className="flex flex-col rounded-xl bg-white shadow-sm border border-gray-100">
      <div className="flex items-start p-4 pb-2">
        <Link href={`/items/${item.id}`} className="min-w-0 flex-1 flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 truncate">{item.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {location && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                <MapPin className="h-3 w-3" />
                {location.name}
              </span>
            )}
            {category && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: category.color ? `${category.color}20` : '#6b728020',
                  color: category.color || '#6b7280',
                }}
              >
                <Package className="h-3 w-3" />
                {category.name}
              </span>
            )}
          </div>

          {expirationStatus && (
            <div className="flex flex-wrap gap-2 mt-2 mb-3">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-lg ${
                  expirationStatus === 'expired'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{expirationStatus === 'expired' ? 'Expired' : 'Expiring soon'}</span>
              </div>
            </div>
          )}
        </Link>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 ml-4 flex-shrink-0"
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        <QuantityControls
          item={item}
          quantity={item.quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onPartialUse={onPartialUse}
        />
      </div>
    </div>
  )
}
