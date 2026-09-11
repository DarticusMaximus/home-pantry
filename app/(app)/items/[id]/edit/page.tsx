'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ItemForm } from '@/components/items/item-form'
import { BackLink } from '@/components/layout/back-link'
import { Skeleton } from '@/components/ui/skeleton/skeleton'
import { useCategories } from '@/hooks/use-categories'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useItem } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { deleteItem, updateItem } from '@/lib/appwrite/items'
import { DELETE_RETRY_COPY, SAVE_RETRY_COPY } from '@/lib/household-copy'
import type { ItemFormOutput, UpdateItemInput } from '@/types/item'

export default function EditItemPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { item, isLoading, error } = useItem(id)
  const showSkeleton = useDelayedLoading(isLoading)
  const { categories } = useCategories()
  const { locations } = useLocations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleRemove = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await deleteItem(id)
      router.push('/')
    } catch {
      setErrorMessage(DELETE_RETRY_COPY)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (data: ItemFormOutput) => {
    if (!item) return
    if (data.quantity <= 0) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const updateData: UpdateItemInput = {
        name: data.name,
        locationId: data.locationId,
        quantity: data.quantity,
        unit: data.unit,
        templateId: data.templateId,
        categoryId: data.categoryId,
        expirationDate: data.expirationDate,
        purchaseDate: data.purchaseDate,
        notes: data.notes,
      }
      await updateItem(id, updateData)
      router.push(`/items/${id}`)
    } catch {
      setErrorMessage(SAVE_RETRY_COPY)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showSkeleton) {
    return (
      <div className="p-4">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href={`/items/${id}`} />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-24 rounded" />
          <Skeleton className="h-10 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href={`/items/${id}`} />
          <h2 className="text-xl font-semibold text-gray-900">Edit Item</h2>
        </div>
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="text-red-600">Something went wrong loading this item. Try going back.</p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-emerald-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-4">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href={`/items/${id}`} />
          <h2 className="text-xl font-semibold text-gray-900">Edit Item</h2>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-gray-500">Item not found</p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-emerald-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center gap-2">
        <BackLink href={`/items/${id}`} />
        <h2 className="text-xl font-semibold text-gray-900">Edit Item</h2>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{errorMessage}</div>
      )}

      <ItemForm
        initialData={item}
        categories={categories}
        locations={locations}
        onSubmit={handleSubmit}
        onRemove={handleRemove}
        onCancel={() => router.push(`/items/${id}`)}
        isLoading={isSubmitting}
      />
    </div>
  )
}
