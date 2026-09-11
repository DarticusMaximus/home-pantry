'use client'

import { SearchX } from 'lucide-react'
import { ItemCard } from '@/components/items/item-card'
import {
  ITEM_CARD_SKELETON_KEYS,
  ItemCardSkeleton,
} from '@/components/ui/skeleton/item-card-skeleton'
import type { Category } from '@/types/category'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'

interface SearchResultsProps {
  items: Item[]
  locations: Location[]
  categories: Category[]
  isLoading: boolean
  onEdit?: (item: Item) => void
  searchQuery: string
  onAddItemShortcut: () => void
  onIncrement: (item: Item) => void
  onDecrement: (item: Item) => void
  onPartialUse: (item: Item, amount: number) => void
}

export function SearchResults({
  items,
  locations,
  categories,
  isLoading,
  onEdit,
  searchQuery,
  onAddItemShortcut,
  onIncrement,
  onDecrement,
  onPartialUse,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ITEM_CARD_SKELETON_KEYS.map((key) => (
          <ItemCardSkeleton key={key} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-12 px-6 text-center">
        <SearchX className="mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900">
          No items found{searchQuery ? ` for "${searchQuery}"` : ''}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your filters or clearing your search
        </p>
        {searchQuery && (
          <button
            type="button"
            onClick={onAddItemShortcut}
            className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors min-h-[44px]"
          >
            Add this item?
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          location={locations.find((l) => l.id === item.locationId)}
          category={item.categoryId ? categories.find((c) => c.id === item.categoryId) : undefined}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          onIncrement={() => onIncrement(item)}
          onDecrement={() => onDecrement(item)}
          onPartialUse={(amount) => onPartialUse(item, amount)}
        />
      ))}
    </div>
  )
}
