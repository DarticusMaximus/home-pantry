'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ItemForm } from '@/components/items/item-form'
import { BackLink } from '@/components/layout/back-link'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-categories'
import { useLocations } from '@/hooks/use-locations'
import { useTemplate } from '@/hooks/use-templates'
import { createItem } from '@/lib/appwrite/items'
import { SAVE_RETRY_COPY } from '@/lib/household-copy'
import type { CreateItemInput, ItemFormOutput } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

type AddItemScreenProps = {
  defaultName?: string
  restockTemplate?: ItemTemplate
  restockError?: string | null
}

function AddItemScreen({ defaultName, restockTemplate, restockError }: AddItemScreenProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { categories } = useCategories()
  const { locations } = useLocations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const displayError = errorMessage ?? restockError ?? null

  const handleSubmit = async (data: ItemFormOutput) => {
    if (!user?.$id) {
      setErrorMessage('You must be logged in to create items')
      return
    }

    const name = typeof data.name === 'string' ? data.name.trim() : ''
    if (!name) {
      setErrorMessage('Item name is required')
      return
    }

    const locationId = typeof data.locationId === 'string' ? data.locationId : ''
    if (!locationId) {
      setErrorMessage('A location is required')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const itemData: CreateItemInput = {
        name,
        locationId,
        quantity: data.quantity ?? 1,
        unit: data.unit ?? 'each',
        templateId: data.templateId,
        categoryId: data.categoryId,
        expirationDate: data.expirationDate,
        purchaseDate: data.purchaseDate,
        notes: data.notes,
        createdById: user.$id,
      }
      const result = await createItem(itemData)
      router.push(`/items/${result.id}`)
    } catch {
      setErrorMessage(SAVE_RETRY_COPY)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-6 flex items-center gap-2">
        <BackLink href="/" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Item</h1>
          <p className="text-sm text-gray-500">Add a new item to your inventory</p>
        </div>
      </div>

      {displayError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{displayError}</div>
      )}

      <ItemForm
        defaultName={restockTemplate ? undefined : defaultName}
        restockTemplate={restockTemplate}
        categories={categories}
        locations={locations}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/')}
        isLoading={isSubmitting}
      />
    </div>
  )
}

function AddItemFromTemplate({
  templateId,
  defaultName,
}: {
  templateId: string
  defaultName?: string
}) {
  const { template, isLoading, error } = useTemplate(templateId)
  const restockError = !isLoading && (error || !template) ? 'Template not found' : null

  return (
    <AddItemScreen
      defaultName={defaultName}
      restockTemplate={restockError ? undefined : (template ?? undefined)}
      restockError={restockError}
    />
  )
}

export default function AddItemPage() {
  const searchParams = useSearchParams()
  const nameParam = searchParams.get('name') ?? undefined
  const rawTemplateId = searchParams.get('templateId')
  const templateId = rawTemplateId && rawTemplateId.trim() !== '' ? rawTemplateId : null

  if (templateId) {
    return <AddItemFromTemplate templateId={templateId} defaultName={nameParam} />
  }

  return <AddItemScreen defaultName={nameParam} />
}
