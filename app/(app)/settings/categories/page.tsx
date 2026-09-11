'use client'

import { useRouter } from 'next/navigation'
import { CategoriesList } from '@/components/settings/categories-list'
import { SettingsResourcePage } from '@/components/settings/settings-resource-page'
import { useCategories } from '@/hooks/use-categories'
import { useDeleteCategory } from '@/hooks/use-category-mutations'
import { getCategoryInUse } from '@/lib/appwrite/categories'
import { formatCategoryInUseCopy } from '@/lib/in-use-copy'

export default function CategoriesPage() {
  const router = useRouter()
  const { categories, isLoading, error, refetch } = useCategories()
  const deleteCategory = useDeleteCategory(refetch)

  return (
    <SettingsResourcePage
      title="Categories"
      backHref="/settings"
      addHref="/settings/categories/add"
      loadErrorCopy="Something went wrong loading categories. Try again to reload."
      deleteTitle="Delete Category"
      deleteDescription="Are you sure you want to delete this category? This action cannot be undone."
      fallbackName="this category"
      items={categories}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      deleteMutation={deleteCategory}
      getInUse={getCategoryInUse}
      formatInUseCopy={formatCategoryInUseCopy}
      onEdit={(id) => router.push(`/settings/categories/${id}`)}
      onAdd={() => router.push('/settings/categories/add')}
      renderList={({ items, onEdit, onDelete, onAdd }) => (
        <CategoriesList categories={items} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} />
      )}
    />
  )
}
