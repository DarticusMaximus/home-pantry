'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { CategoryForm } from '@/components/settings/category-form'
import { useCategories } from '@/hooks/use-categories'
import { useUpdateCategory } from '@/hooks/use-category-mutations'
import { SAVE_RETRY_COPY } from '@/lib/household-copy'

export default function EditCategoryPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { categories, isLoading, error } = useCategories()
  const updateCategory = useUpdateCategory(id)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const category = categories.find((cat) => cat.id === id)

  const handleSubmit = async (data: Parameters<typeof updateCategory.mutate>[0]) => {
    setSubmitError(null)
    try {
      await updateCategory.mutate(data)
      router.push('/settings/categories')
    } catch {
      setSubmitError(SAVE_RETRY_COPY)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/categories" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Category</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/categories" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Category</h2>
        </div>
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="text-red-600">Failed to load category: {error.message}</p>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/categories" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Category</h2>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-gray-500">Category not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BackLink href="/settings/categories" />
        <h2 className="text-xl font-semibold text-gray-900">Edit Category</h2>
      </div>

      {submitError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-xl">
        <CategoryForm
          initialData={category}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/settings/categories')}
          isLoading={updateCategory.isLoading}
        />
      </div>
    </div>
  )
}
