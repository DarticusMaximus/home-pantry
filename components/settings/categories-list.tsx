'use client'

import { Edit2, Tag, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { Category } from '@/types/category'

interface CategoriesListProps {
  categories: Category[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdd?: () => void
}

export function CategoriesList({ categories, onEdit, onDelete, onAdd }: CategoriesListProps) {
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        heading="No categories yet"
        body="Add one to group similar items."
        action={onAdd ? { label: 'Add category', onClick: onAdd } : undefined}
      />
    )
  }

  return (
    <ul className="space-y-4">
      {sortedCategories.map((category) => (
        <li
          key={category.id}
          className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            {category.color && (
              <div
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{category.name}</p>
              {category.description && (
                <p className="text-sm text-gray-500 truncate">{category.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onEdit(category.id)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={`Edit ${category.name}`}
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(category.id)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
              aria-label={`Delete ${category.name}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
