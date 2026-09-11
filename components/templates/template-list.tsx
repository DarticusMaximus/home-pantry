'use client'

import { PlusCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TemplateCardSkeleton } from '@/components/ui/skeleton/template-card-skeleton'
import type { Category } from '@/types/category'
import type { ItemTemplate } from '@/types/template'
import { TemplateCard } from './template-card'

interface TemplateListProps {
  templates: ItemTemplate[]
  categories: Category[]
  onEdit: (template: ItemTemplate) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

export function TemplateList({
  templates,
  categories,
  onEdit,
  onDelete,
  isLoading = false,
}: TemplateListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {['a', 'b', 'c', 'd'].map((k) => (
          <TemplateCardSkeleton key={k} />
        ))}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={PlusCircle}
        heading="No templates yet"
        body="Add your first template to speed up item entry."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          categoryName={categories.find((c) => c.id === template.categoryId)?.name}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
