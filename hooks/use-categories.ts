import { getCategories } from '@/lib/appwrite/categories'
import { createFetchHook } from '@/lib/hooks/create-fetch-hook'
import type { Category } from '@/types/category'

const useCategoriesBase = createFetchHook<Category>(getCategories, 'Failed to fetch categories')

interface UseCategoriesReturn {
  categories: Category[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useCategories(): UseCategoriesReturn {
  const { data, isLoading, error, refetch } = useCategoriesBase()
  return { categories: data, isLoading, error, refetch }
}
