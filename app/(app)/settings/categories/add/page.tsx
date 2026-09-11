'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { CategoryForm } from '@/components/settings/category-form'
import { useCategories } from '@/hooks/use-categories'
import { useCreateCategory } from '@/hooks/use-category-mutations'
import { SAVE_RETRY_COPY } from '@/lib/household-copy'

export default function AddCategoryPage() {
  const router = useRouter()
  const { refetch } = useCategories()
  const createCategory = useCreateCategory(refetch)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: Parameters<typeof createCategory.mutate>[0]) => {
    setError(null)
    try {
      await createCategory.mutate(data)
      router.push('/settings/categories')
    } catch {
      setError(SAVE_RETRY_COPY)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BackLink href="/settings/categories" />
        <h2 className="text-xl font-semibold text-gray-900">Add Category</h2>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="rounded-xl bg-white p-6 shadow-xl">
        <CategoryForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/settings/categories')}
          isLoading={createCategory.isLoading}
        />
      </div>
    </div>
  )
}
