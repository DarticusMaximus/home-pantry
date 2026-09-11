'use client'

import { Calendar, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { ItemTemplate } from '@/types/template'

interface TemplateCardProps {
  template: ItemTemplate
  categoryName?: string
  onEdit: (template: ItemTemplate) => void
  onDelete: (id: string) => void
}

export function TemplateCard({ template, categoryName, onEdit, onDelete }: TemplateCardProps) {
  return (
    <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-lg font-medium text-gray-900 truncate">{template.name}</h3>
          {categoryName && (
            <span className="inline-block px-2 py-0.5 mt-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
              {categoryName}
            </span>
          )}
        </div>
        <div className="flex gap-1 ml-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(template)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label={`Edit ${template.name}`}
          >
            <Pencil className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(template.id)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label={`Delete ${template.name}`}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="px-2.5 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg">
          {template.defaultQuantity} {template.defaultUnit}
        </div>

        {template.defaultExpirationDays && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium bg-amber-50 text-amber-700 rounded-lg">
            <Calendar className="h-3.5 w-3.5" />
            <span>Expires in {template.defaultExpirationDays} days</span>
          </div>
        )}
      </div>

      {template.notes && (
        <p className="text-sm text-gray-500 line-clamp-2 italic mb-3">{template.notes}</p>
      )}

      <Link
        href={`/items/add?templateId=${template.id}`}
        aria-label={`Add ${template.name} to pantry`}
        className="mt-auto flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white hover:bg-emerald-600 min-h-[44px] transition-colors"
      >
        Add to pantry
      </Link>
    </div>
  )
}
